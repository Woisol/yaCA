import type { AgentEvent, AssistantEvent, ChatMessage, ModelClient } from '@yaca/types';
import { applySxmlPatch, createYacaSxmlParser, endAndDrain, writeAndDrain, YacaSxmlParserOptions, type YacaSxmlEvent, type YacaSxmlPatch } from '../parser/sxml-adapter.js';
import { Logger } from '@yaca/utils/logger.js';
import type { AgentRunOptions, AssistantTurnContext, PendingToolCall, StreamTurnResult, ToolFailureCall } from './assistant-turn.js';
import { formatError, isAbortError } from './assistant-turn.js';

export function createSxmlAssistantTurn(model: ModelClient, parserOptions: YacaSxmlParserOptions = {}): (messages: ChatMessage[], options: AgentRunOptions, context: AssistantTurnContext) => AsyncGenerator<AgentEvent, StreamTurnResult> {
  const logger = new Logger('SxmlAssistantTurn');
  return async function* streamSxmlAssistantTurn(messages, options, context) {
    const parser = createYacaSxmlParser({ tryFallback: parserOptions.tryFallback });
    const parsedEvents: YacaSxmlEvent[] = [];
    const calls: PendingToolCall[] = [];
    const parseFailures: ToolFailureCall[] = [];
    let response = '';

    try {
      for await (const chunk of readModelChunks(model, messages, options)) {
        response += chunk;
        for (const patch of writeAndDrain(parser, chunk)) {
          const normalizedPatch = assignPatchCallIds(patch, context.createCallId);
          const event = applyStreamingPatch(parsedEvents, normalizedPatch, context.createCallId);
          yield { type: 'assistant_event', patch: normalizedPatch };
          calls.push(...event.calls);
          parseFailures.push(...event.parseFailures);
        }
      }
      logger.debug('full response: ' + response);
      for (const patch of endAndDrain(parser)) {
        const normalizedPatch = assignPatchCallIds(patch, context.createCallId);
        const event = applyStreamingPatch(parsedEvents, normalizedPatch, context.createCallId);
        yield { type: 'assistant_event', patch: normalizedPatch };
        calls.push(...event.calls);
        parseFailures.push(...event.parseFailures);
      }
      return { response, calls, parseFailures, stopped: false };
    } catch (error) {
      if (isAbortError(error)) {
        return { response, calls, parseFailures, stopped: true };
      }
      yield { type: 'error', message: `Model request failed: ${formatError(error)}` };
      return { response, calls, parseFailures, stopped: true };
    }
  };
}

async function* readModelChunks(model: ModelClient, messages: ChatMessage[], options: AgentRunOptions): AsyncIterable<string> {
  if (model.streamComplete) {
    yield* model.streamComplete(messages, options);
    return;
  }
  yield await model.complete(messages, options);
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

function formatAssistantToolCallRawResponse(event: Extract<YacaSxmlEvent, { type: 'tool_call' }>): string {
  return `<tool_call name="${event.toolName}">${event.content}</tool_call>`;
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
