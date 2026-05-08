import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentLoop, applySxmlPatch, collectAssistantText } from '@yaca/agent-core';
import type { YacaSxmlEvent } from '@yaca/agent-core';
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
  const agent = new AgentLoop({ model, tools, maxTurns: 3, postponeToolCalls: 1 });

  const events = await agent._run([{ role: 'user', content: 'read it' }]);

  assert.deepEqual(executed, ['read_file']);
  assert.deepEqual(events.map((event) => event.type), [
    'assistant_event',
    'assistant_event',
    'assistant_text',
    'tool_call',
    'tool_result',
    'assistant_event',
    'assistant_text'
  ]);
});

test('AgentLoop streams raw assistant text events before the model stream finishes', async () => {
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
  const agent = new AgentLoop({ model, tools, maxTurns: 1, postponeToolCalls: 1 });
  const iterator = agent.runStream([{ role: 'user', content: 'hi' }])[Symbol.asyncIterator]();

  const first = await iterator.next();

  assert.deepEqual(first.value, { type: 'assistant_event', patch: { update: undefined, append: [{ type: 'text', content: 'hello ' }] } });
  releaseSecondChunk?.();
  const second = await iterator.next();
  assert.deepEqual(second.value, { type: 'assistant_event', patch: { update: { type: 'text', content: 'hello world' }, append: [] } });
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
  const agent = new AgentLoop({ model, tools, maxTurns: 1, postponeToolCalls: 1 });
  const events: AgentEvent[] = [];

  for await (const event of agent.runStream([{ role: 'user', content: 'read it' }])) {
    events.push(event);
  }

  assert.deepEqual(executed, ['read_file']);
  assert.deepEqual(events.slice(-2).map((event) => event.type), ['tool_call', 'tool_result']);
  const parsedEvents: YacaSxmlEvent[] = [];
  for (const event of events) {
    if (event.type === 'assistant_event') applySxmlPatch(parsedEvents, event.patch);
  }
  const appended = events.flatMap((event) => event.type === 'assistant_event' ? event.patch.append : []);
  assert.equal(appended.some((event) => event.type === 'tool_call'), true);
  assert.equal(collectAssistantText(parsedEvents), 'Need  after');
});

test('AgentLoop emits raw assistant events and links tool result by call_id', async () => {
  const responses = [
    'Need <tool_call name="read_file">{"path":"a.txt"}</tool_call>',
    'Recovered'
  ];
  const model: ModelClient = {
    async complete() {
      return responses.shift() ?? '';
    }
  };
  const tools = {
    async execute(): Promise<ToolResult> {
      throw new Error('disk failed');
    },
    hint() {
      return 'hint';
    }
  };
  const agent = new AgentLoop({ model, tools, maxTurns: 2, postponeToolCalls: 1 });

  const events = await agent._run([{ role: 'user', content: 'read it' }]);
  const toolCall = events
    .flatMap((event) => event.type === 'assistant_event' ? event.patch.append : [])
    .find((event) => event.type === 'tool_call');
  const toolResult = events.find((event) => event.type === 'tool_result');

  assert.ok(toolCall);
  assert.ok(toolResult);
  assert.equal(toolCall.call_id, toolResult.call_id);
  assert.match(toolResult.rawResponse, /<tool_call name="read_file">/);
  assert.equal(toolResult.result.ok, false);
  assert.match(toolResult.result.content, /disk failed/);
  assert.equal(events.at(-1)?.type, 'assistant_text');
});

test('AgentLoop preserves raw tool call response on tool call events', async () => {
  const model: ModelClient = {
    async complete() {
      return 'Need <tool_call name="read_file">{ "path" : "a.txt" }</tool_call>';
    }
  };
  const tools = {
    async execute(): Promise<ToolResult> {
      return { ok: true, content: 'file content' };
    },
    hint() {
      return 'hint';
    }
  };
  const agent = new AgentLoop({ model, tools, maxTurns: 1, postponeToolCalls: 1 });

  const events = await agent._run([{ role: 'user', content: 'read it' }]);
  const toolCall = events.find((event) => event.type === 'tool_call');

  assert.ok(toolCall);
  assert.equal(toolCall.rawResponse, '<tool_call name="read_file">{ "path" : "a.txt" }</tool_call>');
});

test('AgentLoop returns malformed tool call JSON to the model as a tool result', async () => {
  const responses = [
    'Bad call <tool_call name="read_file">{"path":</tool_call>',
    'Recovered from parse error'
  ];
  const modelMessages: string[] = [];
  const model: ModelClient = {
    async complete(messages) {
      modelMessages.push(JSON.stringify(messages.at(-1)));
      return responses.shift() ?? '';
    }
  };
  const executed: string[] = [];
  const tools = {
    async execute(name: string): Promise<ToolResult> {
      executed.push(name);
      return { ok: true, content: 'should not run' };
    },
    hint() {
      return 'hint';
    }
  };
  const agent = new AgentLoop({ model, tools, maxTurns: 2, postponeToolCalls: 1 });

  const events = await agent._run([{ role: 'user', content: 'read it' }]);
  const parseResult = events.find((event) => event.type === 'tool_result');

  assert.deepEqual(executed, []);
  assert.ok(parseResult);
  assert.equal(parseResult.result.ok, false);
  assert.match(parseResult.result.content, /Failed to parse assistant tool call/);
  assert.match(modelMessages.at(-1) ?? '', /Failed to parse assistant tool call/);
  assert.equal(events.at(-1)?.type, 'assistant_text');
});
