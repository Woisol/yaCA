#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { loadEnvFile, stdout as output } from 'node:process';
import { AgentLoop, ConfigStore, createModelClient, createToolPermissionController, parseUserInput, SessionStore, type CliState } from '@yaca/agent-core';
import { createDefaultToolRegistry } from '@yaca/agent-tools';
import { startInkRepl } from '@yaca/cli/screens/repl-ui.js';
import { IS_DEV } from '../packages/shared/constants/dev.js';
import { Logger } from '@yaca/utils/logger.js';

type CliArgs = {
  serve?: number;
  model?: string;
  baseUrl?: string;
  once?: string;
  continue?: boolean;
};

export async function main(argv = process.argv.slice(2)): Promise<void> {
  // const logger = new Logger("main");

  if (IS_DEV) loadEnvFile();

  const args = parseArgs(argv);
  const configStore = new ConfigStore();
  const config = await configStore.load();
  const configMtimeMs = await configStore.getMtimeMs();

  const model = args.model ?? config.model;
  const baseUrl = args.baseUrl ?? config.base_url;
  const state: CliState = {
    model,
    baseUrl,
    apiKey: process.env.YACA_API_KEY ?? config.api_key,
    configMtimeMs,
    trustMode: false,
    config,
    configStore
  };

  // runtime
  const cwd = process.cwd();
  const store = new SessionStore({ workspace: cwd });
  const toolPermissions = createToolPermissionController(state, {
    request: (request) => state.toolCallConfirm?.(request) ?? false
  });
  const tools = createDefaultToolRegistry(cwd);
  const createAgent = () => {
    const runtimeConfig = state.config;
    return new AgentLoop({
      model: createModelClient({ baseUrl: state.baseUrl, model: state.model, apiKey: state.apiKey }),
      maxTurns: runtimeConfig.max_turns,
      maxToolRetry: runtimeConfig.max_tool_retry,
      tools,
      postponeToolCalls: runtimeConfig.tool_call.postpone_tool_calls,
      toolCallCompatible: runtimeConfig.tool_call.tool_call_compatible,
      toolCallTryFallback: runtimeConfig.tool_call.try_fallback,
      onBeforeToolCall: toolPermissions.confirm
    });
  };

  if (args.continue) {
    const sessionsId = await (await store.listSessions()).at(0)?.id;
    if (sessionsId) {
      state.sessionId = sessionsId;
    }
  }

  if (args.serve !== undefined) {
    try {
      const { startYacaWebServer } = await import('@woisol-g/yaca-web/server.js');
      const { buildYacaWebSystemPrompt } = await import('@woisol-g/yaca-web/server/prompt.js');
      const createWebAgent = () => {
        const runtimeConfig = state.config;
        return new AgentLoop({
          model: createModelClient({ baseUrl: state.baseUrl, model: state.model, apiKey: state.apiKey }),
          maxTurns: runtimeConfig.max_turns,
          maxToolRetry: runtimeConfig.max_tool_retry,
          tools,
          postponeToolCalls: runtimeConfig.tool_call.postpone_tool_calls,
          toolCallCompatible: runtimeConfig.tool_call.tool_call_compatible,
          toolCallTryFallback: runtimeConfig.tool_call.try_fallback,
          onBeforeToolCall: toolPermissions.confirm,
          systemPrompt: buildYacaWebSystemPrompt({
            toolCallCompatible: runtimeConfig.tool_call.tool_call_compatible,
            toolHint: tools.hint()
          })
        });
      };
      startYacaWebServer({ port: args.serve, cwd, state, store, tools, toolPermissions, createAgent: createWebAgent });
      output.write(`YACA server listening on http://127.0.0.1:${args.serve}\n`);
    } catch (error: any) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        output.write('Error: Web UI module (@woisol-g/yaca-web) is not installed or built.\nTry executing `pnpm install @woisol-g/yaca-web` first.');
      } else {
        throw error;
      }
    }
    return;
  }

  if (args.once) {
    const session = await store.createSession(args.once.slice(0, 80));
    state.sessionId = session.id;
    await runOne(args.once, state, store, createAgent(), cwd);
    return;
  }

  startInkRepl({ cwd, state, store, tools, toolPermissions, createAgent });
}

async function runOne(inputText: string, state: CliState, store: SessionStore, agent: AgentLoop, cwd: string): Promise<void> {
  if (!state.sessionId) {
    state.sessionId = (await store.createSession(inputText.slice(0, 80))).id;
  }
  const content = await parseUserInput(inputText, cwd);
  await store.appendMessage(state.sessionId, { role: 'user', content });
  const events = await agent._run(await store.readMessages(state.sessionId));
  for (const event of events) {
    if (event.type === 'assistant_text') {
      output.write(`${event.text}\n`);
      await store.appendMessage(state.sessionId, { role: 'assistant', content: event.text });
    } else if (event.type === 'assistant_delta') {
      output.write(event.text);
    } else if (event.type === 'assistant_replace') {
      output.write(`\n${event.text}`);
    } else if (event.type === 'assistant_event') {
      for (const item of event.patch.append) {
        if (item.type === 'text' || item.type === 'think') {
          output.write(item.content);
        } else if (item.type === 'tool_call') {
          output.write(`tool ${item.toolName} running\n`);
        } else if (item.type === 'parse_error') {
          output.write(`Error: ${item.message}\n`);
        }
      }
    } else if (event.type === 'tool_call') {
      output.write(`tool ${event.call.name} ${JSON.stringify(event.call.args)}\n`);
    } else if (event.type === 'tool_result') {
      output.write(`${event.result.ok ? 'ok' : 'error'} ${event.call_id ?? ''}: ${event.result.content}\n`);
    } else {
      output.write(`Error: ${event.message}\n`);
    }
  }
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { model: process.env.YACA_MODEL ?? undefined, baseUrl: process.env.YACA_BASE_URL };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--serve') {
      const port = Number(argv[index + 1] ?? '3000');
      args.serve = Number.isFinite(port) ? port : 3000;
      index += argv[index + 1] ? 1 : 0;
    } else if (value === '--model') {
      args.model = argv[++index] ?? args.model;
    } else if (value === '--baseurl' || value === '--base-url') {
      args.baseUrl = argv[++index] ?? args.baseUrl;
    } else if (value === '--once') {
      args.once = argv[++index] ?? '';
    } else if (value === '--help' || value === '-h') {
      output.write('Usage: yaca [--serve 3000] [--model name] [--baseurl url] [--once prompt]\n');
      process.exit(0);
    } else if (value === '--continue' || value === '-c') {
      args.continue = true;
    }
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
