import type { AgentEvent, ChatMessage, ModelClient, ToolCall, ToolResult } from '@yaca/types';
import { applySxmlPatch, createYacaSxmlParser, endAndDrain, writeAndDrain, type YacaSxmlEvent, type YacaSxmlPatch } from './parser/sxml-adapter.js';

type ToolExecutor = {
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  hint(): string;
};

type StreamTurnResult = {
  response: string;
  calls: ToolCall[];
  stopped: boolean;
};

export class AgentLoop {
  private readonly model: ModelClient;
  private readonly tools: ToolExecutor;
  private readonly maxTurns: number;

  constructor(options: { model: ModelClient; tools: ToolExecutor; maxTurns?: number }) {
    this.model = options.model;
    this.tools = options.tools;
    this.maxTurns = options.maxTurns ?? 8;
  }

  async run(initialMessages: ChatMessage[]): Promise<AgentEvent[]> {
    const events: AgentEvent[] = [];
    let assistantText = '';
    for await (const event of this.runStream(initialMessages)) {
      if (event.type === 'assistant_delta') {
        assistantText += event.text;
      } else if (event.type === 'assistant_replace') {
        assistantText = event.text;
      } else {
        if (assistantText) {
          events.push({ type: 'assistant_text', text: assistantText });
          assistantText = '';
        }
        events.push(event);
      }
    }
    if (assistantText) {
      events.push({ type: 'assistant_text', text: assistantText });
    }
    return events;
  }

  async *runStream(initialMessages: ChatMessage[]): AsyncIterable<AgentEvent> {
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(this.tools.hint()) },
      ...initialMessages
    ];

    for (let turn = 0; turn < this.maxTurns; turn += 1) {
      const turnResult = yield* this.streamAssistantTurn(messages);
      if (turnResult.stopped) break;

      messages.push({ role: 'assistant', content: turnResult.response });
      if (turnResult.calls.length === 0) break;

      for (const call of turnResult.calls) {
        yield { type: 'tool_call', call };
        const result = await this.tools.execute(call.name, call.args);
        yield { type: 'tool_result', call, result };
        messages.push({ role: 'tool', content: JSON.stringify({ tool: call.name, result }) });
      }
    }
  }

  private async *streamAssistantTurn(messages: ChatMessage[]): AsyncGenerator<AgentEvent, StreamTurnResult> {
    const parser = createYacaSxmlParser();
    const parsedEvents: YacaSxmlEvent[] = [];
    const calls: ToolCall[] = [];
    let response = '';
    let visibleText = '';

    try {
      for await (const chunk of this.readModelChunks(messages)) {
        response += chunk;
        for (const patch of writeAndDrain(parser, chunk)) {
          const event = applyStreamingPatch(parsedEvents, patch);
          if (event.type === 'error') {
            yield { type: 'error', message: event.message };
            return { response, calls, stopped: true };
          }
          calls.push(...event.calls);
          const nextVisibleText = readVisibleText(parsedEvents);
          const textEvent = diffVisibleText(visibleText, nextVisibleText);
          visibleText = nextVisibleText;
          if (textEvent) yield textEvent;
        }
      }
      for (const patch of endAndDrain(parser)) {
        const event = applyStreamingPatch(parsedEvents, patch);
        if (event.type === 'error') {
          yield { type: 'error', message: event.message };
          return { response, calls, stopped: true };
        }
        calls.push(...event.calls);
        const nextVisibleText = readVisibleText(parsedEvents);
        const textEvent = diffVisibleText(visibleText, nextVisibleText);
        visibleText = nextVisibleText;
        if (textEvent) yield textEvent;
      }
      return { response, calls, stopped: false };
    } catch (error) {
      yield { type: 'error', message: `Model request failed: ${formatError(error)}` };
      return { response, calls, stopped: true };
    }
  }

  private async *readModelChunks(messages: ChatMessage[]): AsyncIterable<string> {
    if (this.model.streamComplete) {
      yield* this.model.streamComplete(messages);
      return;
    }
    yield await this.model.complete(messages);
  }
}

function applyStreamingPatch(events: YacaSxmlEvent[], patch: YacaSxmlPatch): { type: 'ok'; calls: ToolCall[] } | { type: 'error'; message: string } {
  applySxmlPatch(events, patch);
  for (const event of patch.append) {
    if (event.type === 'parse_error') return { type: 'error', message: event.message };
  }
  return {
    type: 'ok',
    calls: patch.append
      .filter((event): event is Extract<YacaSxmlEvent, { type: 'tool_call' }> => event.type === 'tool_call')
      .map((event) => ({ name: event.toolName, args: event.args }))
  };
}

function readVisibleText(events: YacaSxmlEvent[]): string {
  return events
    .filter((event) => event.type === 'text' || event.type === 'think')
    .map((event) => event.content)
    .join('');
}

function diffVisibleText(previous: string, next: string): AgentEvent | undefined {
  if (next === previous) return undefined;
  if (next.startsWith(previous)) {
    return { type: 'assistant_delta', text: next.slice(previous.length) };
  }
  return { type: 'assistant_replace', text: next };
}

function buildSystemPrompt(toolHint: string): string {
  return [
    'You are YACA, a local coding agent running in a terminal.',
    'When you need a tool, emit exactly: <tool_call name="tool_name">{"arg":"value"}</tool_call>.',
    'Available tools:',
    toolHint
  ].join('\n\n');
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
