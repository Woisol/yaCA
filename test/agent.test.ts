import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentLoop } from '@yaca/agent-core';
import { ModelClient, ToolResult } from '@yaca/types/index.js';

test('AgentLoop emits assistant text, executes tool calls, then asks model again', async () => {
  const responses = [
    'Need file <tool_call name="read_file">{"path":"a.txt"}</tool_call>',
    'Done after tool'
  ];
  const model: ModelClient = {
    async complete() {
      return responses.shift() ?? '';
    }
  };
  const executed: string[] = [];
  const tools = {
    async execute(name: string): Promise<ToolResult> {
      executed.push(name);
      return { ok: true, content: 'file content' };
    },
    hint() {
      return 'hint';
    }
  };
  const agent = new AgentLoop({ model, tools, maxTurns: 3 });

  const events = await agent.run([{ role: 'user', content: 'read it' }]);

  assert.deepEqual(executed, ['read_file']);
  assert.deepEqual(events.map((event) => event.type), [
    'assistant_text',
    'tool_call',
    'tool_result',
    'assistant_text'
  ]);
});
