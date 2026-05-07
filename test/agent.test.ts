import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentLoop } from '@yaca/agent-core';
import { AgentEvent, ModelClient, ToolResult } from '@yaca/types/index.js';

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

test('AgentLoop streams assistant text before the model stream finishes', async () => {
  let releaseSecondChunk: (() => void) | undefined;
  const secondChunkReady = new Promise<void>((resolve) => {
    releaseSecondChunk = resolve;
  });
  const model: ModelClient = {
    async complete() {
      throw new Error('complete should not be used for streaming');
    },
    async *streamComplete() {
      yield 'hello ';
      await secondChunkReady;
      yield 'world';
    }
  };
  const tools = {
    async execute(): Promise<ToolResult> {
      return { ok: true, content: '' };
    },
    hint() {
      return 'hint';
    }
  };
  const agent = new AgentLoop({ model, tools, maxTurns: 1 });
  const iterator = agent.runStream([{ role: 'user', content: 'hi' }])[Symbol.asyncIterator]();

  const first = await iterator.next();

  assert.deepEqual(first.value, { type: 'assistant_delta', text: 'hello ' });
  releaseSecondChunk?.();
  const second = await iterator.next();
  assert.deepEqual(second.value, { type: 'assistant_delta', text: 'world' });
});

test('AgentLoop streams tool calls as soon as sxml confirms the closing tag', async () => {
  const model: ModelClient = {
    async complete() {
      throw new Error('complete should not be used for streaming');
    },
    async *streamComplete() {
      yield 'Need <tool_call name="read_file">{"path"';
      yield ':"a.txt"}</tool_call> after';
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
  const agent = new AgentLoop({ model, tools, maxTurns: 1 });
  const events: AgentEvent[] = [];

  for await (const event of agent.runStream([{ role: 'user', content: 'read it' }])) {
    events.push(event);
  }

  assert.deepEqual(executed, ['read_file']);
  assert.equal(events.some((event) => event.type === 'assistant_replace'), true);
  assert.deepEqual(events.slice(-2).map((event) => event.type), ['tool_call', 'tool_result']);
  const visibleText = events.reduce((text, event) => {
    if (event.type === 'assistant_delta') return text + event.text;
    if (event.type === 'assistant_replace') return event.text;
    return text;
  }, '');
  assert.equal(visibleText, 'Need  after');
  assert.equal(visibleText.includes('<tool_call'), false);
});
