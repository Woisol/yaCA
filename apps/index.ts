#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { stdout as output } from 'node:process';
import { AgentLoop, ConfigStore, createModelClient, parseUserInput, SessionStore, type CliState } from '@yaca/agent-core';
import { createDefaultToolRegistry } from '@yaca/agent-tools';
import { startServer } from '@yaca/web/server.js';
import { startInkRepl } from '@yaca/cli/screens/repl-ui.js';

type CliArgs = {
  serve?: number;
  model?: string;
  baseUrl?: string;
  once?: string;
};

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const configStore = new ConfigStore();
  const config = await configStore.load();

  const model = args.model ?? config.model;
  const baseUrl = args.baseUrl ?? config.base_url;
  const state: CliState = { model, baseUrl, apiKey: process.env.YACA_API_KEY ?? config.api_key, config, configStore };

  // runtime
  const cwd = process.cwd();
  const store = new SessionStore({ workspace: cwd });
  const tools = createDefaultToolRegistry(cwd);
  const createAgent = () => new AgentLoop({ model: createModelClient({ baseUrl: state.baseUrl, model: state.model, apiKey: state.apiKey }), tools });

  if (args.serve !== undefined) {
    startServer({ port: args.serve, agent: createAgent(), cwd });
    output.write(`YACA server listening on http://127.0.0.1:${args.serve}\n`);
    return;
  }

  if (args.once) {
    const session = await store.createSession(args.once.slice(0, 80));
    state.sessionId = session.id;
    await runOne(args.once, state, store, createAgent(), cwd);
    return;
  }

  startInkRepl({ cwd, state, store, createAgent });
}

async function runOne(inputText: string, state: CliState, store: SessionStore, agent: AgentLoop, cwd: string): Promise<void> {
  if (!state.sessionId) {
    state.sessionId = (await store.createSession(inputText.slice(0, 80))).id;
  }
  const content = await parseUserInput(inputText, cwd);
  await store.appendMessage(state.sessionId, { role: 'user', content });
  const events = await agent.run(await store.readMessages(state.sessionId));
  for (const event of events) {
    if (event.type === 'assistant_text') {
      output.write(`${event.text}\n`);
      await store.appendMessage(state.sessionId, { role: 'assistant', content: event.text });
    } else if (event.type === 'assistant_delta') {
      output.write(event.text);
    } else if (event.type === 'assistant_replace') {
      output.write(`\n${event.text}`);
    } else if (event.type === 'tool_call') {
      output.write(`tool ${event.call.name} ${JSON.stringify(event.call.args)}\n`);
    } else if (event.type === 'tool_result') {
      output.write(`${event.result.ok ? 'ok' : 'error'} ${event.call.name}: ${event.result.content}\n`);
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
    }
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
