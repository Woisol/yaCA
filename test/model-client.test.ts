import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAICompatibleClient, toOpenAIMessages } from '../packages/agent-core/src/llm/model-client.js';

test('OpenAICompatibleClient completes chat through POST request', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const client = new OpenAICompatibleClient({ baseUrl: 'http://local/v1', model: 'local-model', apiKey: 'key', fetchImpl });

  const result = await client.complete([{ role: 'user', content: 'hi' }]);

  assert.equal(result, 'hello');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'http://local/v1/chat/completions');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal((calls[0]?.init?.headers as Record<string, string>)?.Authorization, 'Bearer key');
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: 'local-model',
    messages: [{ role: 'user', content: 'hi' }],
    stream: false
  });
});

test('OpenAICompatibleClient passes abort signal to non-streaming fetch', async () => {
  const controller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestSignal = init?.signal ?? undefined;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const client = new OpenAICompatibleClient({ baseUrl: 'http://local/v1', model: 'local-model', fetchImpl });

  await client.complete([{ role: 'user', content: 'hi' }], { signal: controller.signal });

  assert.equal(requestSignal, controller.signal);
});

test('OpenAICompatibleClient streams chat chunks through response.body.getReader', async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"he"}}]}\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"llo"}}]}\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n'));
      controller.close();
    }
  });
  const fetchImpl: typeof fetch = async () => {
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    });
  };
  const client = new OpenAICompatibleClient({ baseUrl: 'http://local/v1', model: 'local-model', fetchImpl });
  const chunks: string[] = [];

  for await (const chunk of client.streamComplete([{ role: 'user', content: 'hi' }])) {
    chunks.push(chunk);
  }

  assert.deepEqual(chunks, ['he', 'llo']);
});

test('OpenAICompatibleClient passes abort signal to streaming fetch', async () => {
  const controller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestSignal = init?.signal ?? undefined;
    return new Response(null, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    });
  };
  const client = new OpenAICompatibleClient({ baseUrl: 'http://local/v1', model: 'local-model', fetchImpl });

  for await (const _chunk of client.streamComplete([{ role: 'user', content: 'hi' }], { signal: controller.signal })) {
    // drain
  }

  assert.equal(requestSignal, controller.signal);
});

test('OpenAICompatibleClient omits authorization header when no api key is configured', () => {
  const client = OpenAICompatibleClient.createSdkClient({ baseUrl: 'http://local/v1' });

  assert.deepEqual(client.headers, { Authorization: null });
});

test('OpenAICompatibleClient completes chat with standard OpenAI tools', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: 'Need a file',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"a.txt"}' }
          }]
        }
      }]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };
  const client = new OpenAICompatibleClient({ baseUrl: 'http://local/v1', model: 'local-model', fetchImpl });

  const result = await client.completeWithTools?.([{ role: 'user', content: 'read it' }], [{
    name: 'read_file',
    description: 'Read file',
    parameters: { path: 'file path' },
    async execute() {
      return { ok: true, content: '' };
    }
  }]);

  assert.deepEqual(result, {
    content: 'Need a file',
    toolCalls: [{ call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' }, rawResponse: 'call-1' }]
  });
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: 'local-model',
    messages: [{ role: 'user', content: 'read it' }],
    stream: false,
    tools: [{
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read file',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'file path' } },
          required: []
        }
      }
    }]
  });
});

test('OpenAICompatibleClient streams standard OpenAI tool calls and content deltas', async () => {
  const encoder = new TextEncoder();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Need "}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"file","tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"read_file","arguments":"{\\"path\\""}}]}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"a.txt\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    });
  };
  const client = new OpenAICompatibleClient({ baseUrl: 'http://local/v1', model: 'local-model', fetchImpl });
  const iterator = client.streamWithTools!([{ role: 'user', content: 'read it' }], [{
    name: 'read_file',
    description: 'Read file',
    parameters: { path: 'file path' },
    async execute() {
      return { ok: true, content: '' };
    }
  }])[Symbol.asyncIterator]();
  const deltas: string[] = [];

  while (true) {
    const next = await iterator.next();
    if (next.done) {
      assert.deepEqual(next.value, {
        content: 'Need file',
        toolCalls: [{ call_id: 'call-1', name: 'read_file', args: { path: 'a.txt' }, rawResponse: 'call-1' }]
      });
      break;
    }
    deltas.push(next.value.text);
  }

  assert.deepEqual(deltas, ['Need ', 'file']);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: 'local-model',
    messages: [{ role: 'user', content: 'read it' }],
    stream: true,
    tools: [{
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read file',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'file path' } },
          required: []
        }
      }
    }]
  });
});

test('OpenAICompatibleClient streams provider reasoning deltas as think events', async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"check "}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning":"paths"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Done"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
  const fetchImpl: typeof fetch = async () => {
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    });
  };
  const client = new OpenAICompatibleClient({ baseUrl: 'http://local/v1', model: 'local-model', fetchImpl });
  const events: Array<{ type: string; text: string }> = [];
  const iterator = client.streamWithTools!([{ role: 'user', content: 'think' }], [])[Symbol.asyncIterator]();

  while (true) {
    const next = await iterator.next();
    if (next.done) {
      assert.deepEqual(next.value, { content: 'Done', toolCalls: [] });
      break;
    }
    events.push(next.value);
  }

  assert.deepEqual(events, [
    { type: 'think_delta', text: 'check ' },
    { type: 'think_delta', text: 'paths' },
    { type: 'content_delta', text: 'Done' }
  ]);
});

test('toOpenAIMessages preserves image parts and standard tool message fields', () => {
  const messages = toOpenAIMessages([
    {
      role: 'user',
      content: [
        { type: 'text', text: 'describe' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
      ]
    },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: 'call-1',
        type: 'function',
        function: { name: 'read_file', arguments: '{"path":"a.txt"}' }
      }]
    },
    {
      role: 'tool',
      tool_call_id: 'call-1',
      content: '{"ok":true}'
    }
  ]);

  assert.deepEqual(messages, [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'describe' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
      ]
    },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: 'call-1',
        type: 'function',
        function: { name: 'read_file', arguments: '{"path":"a.txt"}' }
      }]
    },
    {
      role: 'tool',
      tool_call_id: 'call-1',
      content: '{"ok":true}'
    }
  ]);
});
