import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AgentLoop } from '@yaca/agent-core';
import { createDefaultToolRegistry, createSubAgentToolDefinitions, ToolRegistry, type SubAgentKind } from '@yaca/agent-tools';
import type { ModelClient, ToolResult } from '@yaca/types';

test('default tool registry exposes explore and edit subagent tools', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-subagent-'));
  const tools = createDefaultToolRegistry(workspace);
  const names = tools.definitions().map((tool) => tool.name);

  assert.ok(names.includes('explore'));
  assert.ok(names.includes('edit'));
});

test('subagent tools delegate the prompt to the configured runner', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-subagent-'));
  const calls: Array<{ kind: SubAgentKind; prompt: string }> = [];
  const tools = createDefaultToolRegistry(workspace, {
    runSubAgent: async (request) => {
      calls.push(request);
      return { ok: true, content: `${request.kind}:${request.prompt}` };
    }
  });

  const result = await tools.execute('explore', { prompt: 'inspect this' });

  assert.deepEqual(calls, [{ kind: 'explore', prompt: 'inspect this' }]);
  assert.deepEqual(result, { ok: true, content: 'explore:inspect this' });
});

test('explore subagent registry excludes write tools while edit includes them', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-subagent-'));

  const context = { cwd: workspace, hint: () => '' };
  const exploreTools = createSubAgentToolDefinitions('explore', context);
  const editTools = createSubAgentToolDefinitions('edit', context);

  const exploreNames = exploreTools.map((tool) => tool.name);
  const editNames = editTools.map((tool) => tool.name);

  assert.ok(exploreNames.includes('read_file'));
  assert.ok(exploreNames.includes('list_directory'));
  assert.ok(!exploreNames.includes('write_file'));
  assert.ok(!exploreNames.includes('replace_file'));
  assert.ok(editNames.includes('write_file'));
  assert.ok(editNames.includes('replace_file'));
});

test('subagent result is returned as the parent tool result', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'yaca-subagent-'));
  const model: ModelClient = {
    async complete() {
      throw new Error('complete should not be used in OpenAI tool mode');
    },
    async completeWithTools(messages) {
      const userPrompt = [...messages].reverse().find((message) => message.role === 'user')?.content;
      if (userPrompt === 'parent prompt') {
        return {
          content: '',
          toolCalls: [{ call_id: 'parent-call', name: 'explore', args: { prompt: 'child prompt' }, rawResponse: 'parent-call' }]
        };
      }
      assert.equal(userPrompt, 'child prompt');
      assert.equal(messages.some((message) => message.content === 'parent prompt'), false);
      return { content: 'child final result', toolCalls: [] };
    }
  };
  const runSubAgent = async ({ kind, prompt }: { kind: SubAgentKind; prompt: string }): Promise<ToolResult> => {
    const subTools = new ToolRegistry();
    subTools.registerMany(createSubAgentToolDefinitions(kind, {
      cwd: workspace,
      hint: (toolName) => subTools.hint(toolName)
    }));
    const subAgent = new AgentLoop({ model, tools: subTools, maxTurns: 1, postponeToolCalls: 1 });
    const textParts: string[] = [];
    for await (const event of subAgent.runStream([{ role: 'user', content: prompt }])) {
      if (event.type === 'assistant_text' || event.type === 'assistant_delta') {
        textParts.push(event.text);
      }
    }
    return { ok: true, content: textParts.join('') };
  };
  const tools = createDefaultToolRegistry(workspace, { runSubAgent });
  const agent = new AgentLoop({ model, tools, maxTurns: 1, postponeToolCalls: 1 });

  const events = await agent._run([{ role: 'user', content: 'parent prompt' }]);
  const result = events.find((event) => event.type === 'tool_result');

  assert.equal(result?.type, 'tool_result');
  assert.deepEqual(result?.type === 'tool_result' ? result.result : undefined, {
    ok: true,
    content: 'child final result'
  });
});
