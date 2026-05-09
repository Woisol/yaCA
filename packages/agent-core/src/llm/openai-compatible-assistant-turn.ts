import type { AgentEvent, ChatMessage, ModelClient } from '@yaca/types';
import type { AgentRunOptions, AssistantTurnContext, StreamTurnResult } from './assistant-turn.js';
import { formatError, isAbortError } from './assistant-turn.js';

export function createOpenAICompatibleAssistantTurn(model: ModelClient): (messages: ChatMessage[], options: AgentRunOptions, context: AssistantTurnContext) => AsyncGenerator<AgentEvent, StreamTurnResult> {
  return async function* streamOpenAICompatibleAssistantTurn(messages, options, context) {
    let response = '';
    try {
      if (model.streamWithTools) {
        const stream = model.streamWithTools(messages, context.tools, options);
        let thinking = '';
        let result = await stream.next();
        while (!result.done) {
          if (result.value.type === 'content_delta') {
            response += result.value.text;
            yield { type: 'assistant_delta', text: result.value.text };
          } else if (result.value.type === 'think_delta') {
            thinking += result.value.text;
            yield {
              type: 'assistant_event',
              patch: thinking === result.value.text
                ? { update: undefined, append: [{ type: 'think', content: thinking }] }
                : { update: { type: 'think', content: thinking }, append: [] }
            };
          }
          result = await stream.next();
        }
        return {
          response: result.value.content || response,
          calls: result.value.toolCalls.map((call) => ({ ...call, call_id: call.call_id ?? context.createCallId() })),
          parseFailures: [],
          stopped: false
        };
      }
      if (!model.completeWithTools) {
        const content = await model.complete(messages, options);
        return { response: content, calls: [], parseFailures: [], stopped: false };
      }
      const result = await model.completeWithTools(messages, context.tools, options);
      response = result.content;
      if (response) {
        yield { type: 'assistant_text', text: response };
      }
      return {
        response,
        calls: result.toolCalls.map((call) => ({ ...call, call_id: call.call_id ?? context.createCallId() })),
        parseFailures: [],
        stopped: false
      };
    } catch (error) {
      if (isAbortError(error)) {
        return { response, calls: [], parseFailures: [], stopped: true };
      }
      yield { type: 'error', message: `Model request failed: ${formatError(error)}` };
      return { response, calls: [], parseFailures: [], stopped: true };
    }
  };
}
