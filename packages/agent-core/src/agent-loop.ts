import type { AgentEvent, AssistantEvent, ChatMessage, ModelClient, ToolCall, ToolResult } from '@yaca/types';
import { applySxmlPatch, collectAssistantText, createYacaSxmlParser, endAndDrain, writeAndDrain, type YacaSxmlEvent, type YacaSxmlPatch } from './parser/sxml-adapter.js';
import { Logger } from '@yaca/utils/logger.js';

type ToolExecutor = {
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  hint(): string;
};

type StreamTurnResult = {
  response: string;
  calls: PendingToolCall[];
  parseFailures: ToolFailureCall[];
  stopped: boolean;
};

type PendingToolCall = ToolCall & {
  rawResponse: string;
};

type ToolFailureCall = {
  call: ToolCall;
  result: ToolResult;
  rawResponse: string;
};

export class AgentLoop {
  private nextCallSequence = 1;
  private readonly model: ModelClient;
  private readonly tools: ToolExecutor;
  private readonly maxTurns: number;
  private readonly maxToolRetry: number;
  private readonly postponeToolCalls: number;
  private readonly logger = new Logger('AgentLoop');

  constructor(options: { model: ModelClient; tools: ToolExecutor; maxTurns?: number; maxToolRetry?: number; postponeToolCalls: number }) {
    this.model = options.model;
    this.tools = options.tools;
    this.postponeToolCalls = options.postponeToolCalls;
    this.maxTurns = options.maxTurns ?? 8;
    this.maxToolRetry = options.maxToolRetry ?? 5;
  }

  /**
   * 同步 agent loop 方法，逐步弃用
   */
  async _run(initialMessages: ChatMessage[]): Promise<AgentEvent[]> {
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
    let consecutiveToolFailures = 0;

    for (let turn = 0; turn < this.maxTurns; turn += 1) {
      const turnResult = yield* this.streamAssistantTurn(messages);
      if (turnResult.stopped) break;

      messages.push({ role: 'assistant', content: turnResult.response });
      if (turnResult.calls.length === 0 && turnResult.parseFailures.length === 0) break;

      for (const failure of turnResult.parseFailures) {
        yield { type: 'tool_call', call: failure.call, rawResponse: failure.rawResponse };
        yield { type: 'tool_result', call_id: failure.call.call_id, result: failure.result, rawResponse: failure.rawResponse };
        messages.push({ role: 'tool', content: JSON.stringify({ result: failure.result }) });
        consecutiveToolFailures = nextConsecutiveToolFailures(consecutiveToolFailures, failure.result);
        if (consecutiveToolFailures >= this.maxToolRetry) {
          yield { type: 'assistant_text', text: buildMaxToolRetryMessage(this.maxToolRetry) };
          return;
        }
      }

      for (const call of turnResult.calls) {
        const rawResponse = formatToolCallRawResponse(call);
        yield { type: 'tool_call', call, rawResponse };
        const result = await executeToolSafely(this.tools, call);
        yield { type: 'tool_result', call_id: call.call_id, result, rawResponse };
        messages.push({ role: 'tool', content: JSON.stringify({ tool: call.name, result }) });
        consecutiveToolFailures = nextConsecutiveToolFailures(consecutiveToolFailures, result);
        if (consecutiveToolFailures >= this.maxToolRetry) {
          yield { type: 'assistant_text', text: buildMaxToolRetryMessage(this.maxToolRetry) };
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, this.postponeToolCalls));
    }
  }

  private async *streamAssistantTurn(messages: ChatMessage[]): AsyncGenerator<AgentEvent, StreamTurnResult> {
    const parser = createYacaSxmlParser();
    const parsedEvents: YacaSxmlEvent[] = [];
    const calls: PendingToolCall[] = [];
    const parseFailures: ToolFailureCall[] = [];
    let response = '';

    try {
      for await (const chunk of this.readModelChunks(messages)) {
        response += chunk;
        for (const patch of writeAndDrain(parser, chunk)) {
          const normalizedPatch = assignPatchCallIds(patch, () => this.createCallId());
          const event = applyStreamingPatch(parsedEvents, normalizedPatch, () => this.createCallId());
          yield { type: 'assistant_event', patch: normalizedPatch };
          calls.push(...event.calls);
          parseFailures.push(...event.parseFailures);
        }
      }
      this.logger.debug("full response: " + response);
      for (const patch of endAndDrain(parser)) {
        const normalizedPatch = assignPatchCallIds(patch, () => this.createCallId());
        const event = applyStreamingPatch(parsedEvents, normalizedPatch, () => this.createCallId());
        yield { type: 'assistant_event', patch: normalizedPatch };
        calls.push(...event.calls);
        parseFailures.push(...event.parseFailures);
      }
      return { response, calls, parseFailures, stopped: false };
    } catch (error) {
      yield { type: 'error', message: `Model request failed: ${formatError(error)}` };
      return { response, calls, parseFailures, stopped: true };
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

function nextConsecutiveToolFailures(current: number, result: ToolResult): number {
  return result.ok ? 0 : current + 1;
}

function buildMaxToolRetryMessage(maxToolRetry: number): string {
  return `Turn terminated because tool calls failed ${maxToolRetry} times.`;
}

function flushAssistantText(events: AgentEvent[], assistantEvents: YacaSxmlEvent[]): void {
  const text = collectAssistantText(assistantEvents);
  if (!text) return;
  events.push({ type: 'assistant_text', text });
  assistantEvents.length = 0;
}

function applyStreamingPatch(events: YacaSxmlEvent[], patch: YacaSxmlPatch, createCallId: () => string): { calls: PendingToolCall[]; parseFailures: ToolFailureCall[] } {
  applySxmlPatch(events, patch);
  return {
    calls: patch.append
      .filter((event): event is Extract<YacaSxmlEvent, { type: 'tool_call' }> => event.type === 'tool_call')
      .map((event) => ({ call_id: event.call_id, name: event.toolName, args: event.args, rawResponse: formatAssistantToolCallRawResponse(event) })),
    parseFailures: patch.append
      .filter((event): event is Extract<YacaSxmlEvent, { type: 'parse_error' }> => event.type === 'parse_error')
      .map((event) => ({
        call: { call_id: createCallId(), name: 'parse_tool_call', args: { content: event.content } },
        result: { ok: false, content: event.message },
        rawResponse: event.content
      }))
  };
}

function formatToolCallRawResponse(call: PendingToolCall): string {
  return call.rawResponse;
}

function formatAssistantToolCallRawResponse(event: Extract<YacaSxmlEvent, { type: 'tool_call' }>): string {
  return `<tool_call name="${event.toolName}">${event.content}</tool_call>`;
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
    'Markdown render is not supported, so use plain text to respond unless requested.',
    'When you need a tool, emit exactly: <tool_call name="tool_name">{"arg":"value"}</tool_call>.',
    'Available tools:',
    toolHint
  ].join('\n\n');
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
