import type { AgentEvent, AssistantEvent, ChatMessage, ModelClient, ToolCall, ToolResult } from '@yaca/types';
import { applySxmlPatch, collectAssistantText, createYacaSxmlParser, endAndDrain, writeAndDrain, type YacaSxmlEvent, type YacaSxmlPatch } from './parser/sxml-adapter.js';

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
  private nextCallSequence = 1;
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
    const assistantEvents: YacaSxmlEvent[] = [];
    for await (const event of this.runStream(initialMessages)) {
      if (event.type === 'assistant_event') {
        applySxmlPatch(assistantEvents, event.patch);
        events.push(event);
      } else {
        flushAssistantText(events, assistantEvents);
        events.push(event);
      }
    }
    flushAssistantText(events, assistantEvents);
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
        const result = await executeToolSafely(this.tools, call);
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

    try {
      for await (const chunk of this.readModelChunks(messages)) {
        response += chunk;
        for (const patch of writeAndDrain(parser, chunk)) {
          const normalizedPatch = assignPatchCallIds(patch, () => this.createCallId());
          const event = applyStreamingPatch(parsedEvents, normalizedPatch);
          if (event.type === 'error') {
            yield { type: 'error', message: event.message };
            return { response, calls, stopped: true };
          }
          yield { type: 'assistant_event', patch: normalizedPatch };
          calls.push(...event.calls);
        }
      }
      for (const patch of endAndDrain(parser)) {
        const normalizedPatch = assignPatchCallIds(patch, () => this.createCallId());
        const event = applyStreamingPatch(parsedEvents, normalizedPatch);
        if (event.type === 'error') {
          yield { type: 'error', message: event.message };
          return { response, calls, stopped: true };
        }
        yield { type: 'assistant_event', patch: normalizedPatch };
        calls.push(...event.calls);
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

  private createCallId(): string {
    return `call-${this.nextCallSequence++}`;
  }
}

function flushAssistantText(events: AgentEvent[], assistantEvents: YacaSxmlEvent[]): void {
  const text = collectAssistantText(assistantEvents);
  if (!text) return;
  events.push({ type: 'assistant_text', text });
  assistantEvents.length = 0;
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
      .map((event) => ({ call_id: event.call_id, name: event.toolName, args: event.args }))
  };
}

async function executeToolSafely(tools: ToolExecutor, call: ToolCall): Promise<ToolResult> {
  try {
    return await tools.execute(call.name, call.args);
  } catch (error) {
    return { ok: false, content: formatError(error) };
  }
}

function assignPatchCallIds(patch: YacaSxmlPatch, createCallId: () => string): YacaSxmlPatch {
  return {
    update: patch.update === undefined ? undefined : patch.update === null ? null : assignEventCallId(patch.update, createCallId),
    append: patch.append.map((event) => assignEventCallId(event, createCallId))
  };
}

function assignEventCallId(event: AssistantEvent, createCallId: () => string): AssistantEvent {
  if (event.type !== 'tool_call' || event.call_id) {
    return event;
  }
  return { ...event, call_id: createCallId() };
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
