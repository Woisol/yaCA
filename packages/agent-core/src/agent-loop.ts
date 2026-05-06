import type { AgentEvent, ChatMessage, ModelClient, ToolResult } from '@yaca/types';
import { applySxmlPatch, collectAssistantText, collectToolCalls, createYacaSxmlParser, endAndDrain, writeAndDrain, type YacaSxmlEvent } from './parser/sxml-adapter.js';

type ToolExecutor = {
  execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  hint(): string;
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
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(this.tools.hint()) },
      ...initialMessages
    ];
    const events: AgentEvent[] = [];

    for (let turn = 0; turn < this.maxTurns; turn += 1) {
      const response = await this.model.complete(messages);
      const parsedEvents = parseAssistantStream(response);
      const assistantText = collectAssistantText(parsedEvents);
      const calls = collectToolCalls(parsedEvents);
      if (assistantText.length > 0) {
        events.push({ type: 'assistant_text', text: assistantText });
      }
      messages.push({ role: 'assistant', content: response });

      if (calls.length === 0) {
        break;
      }

      for (const call of calls) {
        events.push({ type: 'tool_call', call });
        const result = await this.tools.execute(call.name, call.args);
        events.push({ type: 'tool_result', call, result });
        messages.push({ role: 'tool', content: JSON.stringify({ tool: call.name, result }) });
      }
    }

    return events;
  }
}

function parseAssistantStream(response: string): YacaSxmlEvent[] {
  const parser = createYacaSxmlParser();
  const events: YacaSxmlEvent[] = [];
  for (const patch of writeAndDrain(parser, response)) {
    applySxmlPatch(events, patch);
  }
  for (const patch of endAndDrain(parser)) {
    applySxmlPatch(events, patch);
  }
  return events;
}

function buildSystemPrompt(toolHint: string): string {
  return [
    'You are YACA, a local coding agent running in a terminal.',
    'When you need a tool, emit exactly: <tool_call name="tool_name">{"arg":"value"}</tool_call>.',
    'Available tools:',
    toolHint
  ].join('\n\n');
}
