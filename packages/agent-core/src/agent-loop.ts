import type { AgentEvent, ChatMessage, ChatToolCall, ModelClient, ToolCall, ToolDefinition, ToolResult } from '@yaca/types';
import { applySxmlPatch, collectAssistantText, type YacaSxmlEvent } from './parser/sxml-adapter.js';
import { buildOpenAIToolSystemPrompt, buildSystemPrompt } from './llm/prompt.js';
import { createOpenAICompatibleAssistantTurn } from './llm/openai-compatible-assistant-turn.js';
import { createSxmlAssistantTurn } from './llm/sxml-assistant-turn.js';
import type { AgentRunOptions, AssistantTurnStrategy, PendingToolCall } from './llm/assistant-turn.js';
import { formatError } from './llm/assistant-turn.js';

type ToolExecutor = {
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  hint(): string;
  definitions?(): ToolDefinition[];
};

export type ToolCallApproval = (call: ToolCall) => boolean | Promise<boolean>;

export class AgentLoop {
  private nextCallSequence = 1;
  private readonly model: ModelClient;
  private readonly tools: ToolExecutor;
  private readonly maxTurns: number;
  private readonly maxToolRetry: number;
  private readonly postponeToolCalls: number;
  private readonly streamAssistantTurn: AssistantTurnStrategy;
  private readonly toolCallCompatible: boolean;
  private readonly onBeforeToolCall?: ToolCallApproval;
  private readonly systemPrompt?: string;

  constructor(options: { model: ModelClient; tools: ToolExecutor; maxTurns?: number; maxToolRetry?: number; postponeToolCalls: number; toolCallCompatible?: boolean; toolCallTryFallback?: boolean; onBeforeToolCall?: ToolCallApproval; systemPrompt?: string }) {
    this.model = options.model;
    this.tools = options.tools;
    this.postponeToolCalls = options.postponeToolCalls;
    this.maxTurns = options.maxTurns ?? 8;
    this.maxToolRetry = options.maxToolRetry ?? 5;
    this.toolCallCompatible = options.toolCallCompatible ?? false;
    this.onBeforeToolCall = options.onBeforeToolCall;
    this.systemPrompt = options.systemPrompt;
    this.streamAssistantTurn = options.toolCallCompatible
      ? createSxmlAssistantTurn(this.model, { tryFallback: options.toolCallTryFallback })
      : createOpenAICompatibleAssistantTurn(this.model);
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

  async *runStream(initialMessages: ChatMessage[], options: AgentRunOptions = {}): AsyncIterable<AgentEvent> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt ?? (this.toolCallCompatible ? buildSystemPrompt(this.tools.hint()) : buildOpenAIToolSystemPrompt()) },
      ...initialMessages
    ];
    let consecutiveToolFailures = 0;

    for (let turn = 0; turn < this.maxTurns; turn += 1) {
      const turnResult = yield* this.streamAssistantTurn(messages, options, {
        createCallId: () => this.createCallId(),
        tools: this.tools.definitions?.() ?? []
      });
      if (turnResult.stopped) break;

      messages.push(createAssistantHistoryMessage(turnResult.response, turnResult.calls, this.toolCallCompatible));
      if (turnResult.calls.length === 0 && turnResult.parseFailures.length === 0) break;

      for (const failure of turnResult.parseFailures) {
        yield { type: 'tool_call', call: failure.call, rawResponse: failure.rawResponse };
        yield { type: 'tool_result', call_id: failure.call.call_id, result: failure.result, rawResponse: failure.rawResponse };
        messages.push(createToolHistoryMessage(failure.call, failure.result, this.toolCallCompatible));
        consecutiveToolFailures = nextConsecutiveToolFailures(consecutiveToolFailures, failure.result);
        if (consecutiveToolFailures >= this.maxToolRetry) {
          yield { type: 'assistant_text', text: buildMaxToolRetryMessage(this.maxToolRetry) };
          return;
        }
      }

      for (const call of turnResult.calls) {
        const rawResponse = call.rawResponse;
        yield { type: 'tool_call', call, rawResponse };
        const result = await this.executeApprovedToolCall(call);
        yield { type: 'tool_result', call_id: call.call_id, result, rawResponse };
        messages.push(createToolHistoryMessage(call, result, this.toolCallCompatible));
        consecutiveToolFailures = nextConsecutiveToolFailures(consecutiveToolFailures, result);
        if (consecutiveToolFailures >= this.maxToolRetry) {
          yield { type: 'assistant_text', text: buildMaxToolRetryMessage(this.maxToolRetry) };
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, this.postponeToolCalls));
    }
  }

  private createCallId(): string {
    return `call-${this.nextCallSequence++}`;
  }

  private async executeApprovedToolCall(call: ToolCall): Promise<ToolResult> {
    const approved = await this.onBeforeToolCall?.(call);
    if (approved === false) {
      return { ok: false, content: `Tool call denied: ${call.name}` };
    }
    return executeToolSafely(this.tools, call);
  }
}

// TODO 工具类函数应当迁移
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

function createAssistantHistoryMessage(response: string, calls: PendingToolCall[], toolCallCompatible: boolean): ChatMessage {
  if (toolCallCompatible || calls.length === 0) {
    return { role: 'assistant', content: response };
  }
  return {
    role: 'assistant',
    content: response || null,
    tool_calls: calls.map(toOpenAIChatToolCall)
  };
}

function createToolHistoryMessage(call: ToolCall, result: ToolResult, toolCallCompatible: boolean): ChatMessage {
  if (toolCallCompatible) {
    return { role: 'user', content: result.content };
  }
  return {
    role: 'tool',
    content: JSON.stringify({ tool: call.name, result }),
    ...(call.call_id ? { tool_call_id: call.call_id } : {})
  };
}

function toOpenAIChatToolCall(call: PendingToolCall): ChatToolCall {
  return {
    id: call.call_id ?? '',
    type: 'function',
    function: {
      name: call.name,
      arguments: JSON.stringify(call.args)
    }
  };
}

async function executeToolSafely(tools: ToolExecutor, call: ToolCall): Promise<ToolResult> {
  try {
    return await tools.execute(call.name, call.args);
  } catch (error) {
    return { ok: false, content: formatError(error) };
  }
}

