import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAICompatibleClient } from '../packages/agent-core/src/llm/model-client.js';

test('OpenAICompatibleClient completes chat through injected OpenAI SDK client', async () => {
  const calls: unknown[] = [];
  const sdk = {
    chat: {
      completions: {
        create(args: unknown) {
          calls.push(args);
          return Promise.resolve({ choices: [{ message: { content: 'hello' } }] });
        }
      }
    }
  };
  const client = new OpenAICompatibleClient({ baseUrl: 'http://local/v1', model: 'local-model', apiKey: 'key', client: sdk as never });

  const result = await client.complete([{ role: 'user', content: 'hi' }]);

  assert.equal(result, 'hello');
  assert.deepEqual(calls, [{ model: 'local-model', messages: [{ role: 'user', content: 'hi' }], stream: false }]);
});

test('OpenAICompatibleClient streams chat chunks through OpenAI SDK client', async () => {
  const sdk = {
    chat: {
      completions: {
        create() {
          return (async function* () {
            yield { choices: [{ delta: { content: 'he' } }] };
            yield { choices: [{ delta: { content: 'llo' } }] };
          })();
        }
      }
    }
  };
  const client = new OpenAICompatibleClient({ baseUrl: 'http://local/v1', model: 'local-model', client: sdk as never });
  const chunks: string[] = [];

  for await (const chunk of client.streamComplete([{ role: 'user', content: 'hi' }])) {
    chunks.push(chunk);
  }

  assert.deepEqual(chunks, ['he', 'llo']);
});

test('OpenAICompatibleClient omits authorization header when no api key is configured', () => {
  const client = OpenAICompatibleClient.createSdkClient({ baseUrl: 'http://local/v1' });

  assert.deepEqual(client.headers, { Authorization: null });
});
