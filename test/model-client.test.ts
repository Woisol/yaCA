import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAICompatibleClient } from '../packages/agent-core/src/llm/model-client.js';

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
