import React, { useMemo, useState } from 'react';
import { Box, render, Text, useApp, useInput } from 'ink';
import { handleBuiltinCommand, parseUserInput, type AgentLoop, type CliState, type SessionStore } from '@yaca/agent-core';
import { AgentEvent } from '@yaca/types';
import { factoryKeyboardShortcuts } from '../input/registry';

type ChatMessage = {
  id: number;
  kind: 'user' | 'assistant' | 'tool' | 'status' | 'error';
  text: string;
};

export type ReplRuntime = {
  cwd: string;
  state: CliState;
  store: SessionStore;
  createAgent(): AgentLoop;
};

export function startInkRepl(runtime: ReplRuntime): void {
  render(<YacaRepl runtime={runtime} />);
}

function YacaRepl({ runtime }: { runtime: ReplRuntime }) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastCtrlCAt, setLastCtrlCAt] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, kind: 'status', text: 'YACA CLI ready. Send a message to create a session, or type /resume to browse history.' }
  ]);
  const [nextId, setNextId] = useState(2);

  const appendLine = (kind: ChatMessage['kind'], text: string) => {
    // 确实，使用函数式更新更安全，比如在快速输入时……
    setMessages((current) => [...current, { id: nextId, kind, text }]);
    setNextId((current) => current + 1);
  };

  const statusText = useMemo(() => {
    return `model=${runtime.state.model} cwd=${runtime.cwd}`;
  }, [runtime.cwd, runtime.state.model]);

  factoryKeyboardShortcuts();

  // useInput！ink 的输入 hook
  // useInput((value, key) => {
  //   if (busy && key.ctrl && value === 'c') {
  //     appendLine('status', 'Interrupted current operation. The in-flight model request may still finish server-side.');
  //     setBusy(false);
  //     return;
  //   }
  //   if (busy) return;
  //   if (key.return) {
  //     const submitted = input.trim();
  //     setInput('');
  //     if (submitted.length > 0) {
  //       void submit(submitted);
  //     }
  //     return;
  //   }
  //   if (key.escape) {
  //     setInput('');
  //     return;
  //   }
  //   if (key.ctrl && value === 'v') {
  //     appendLine('status', 'Clipboard image paste stores images as @path references when terminal clipboard image data is available.');
  //     return;
  //   }
  //   if (key.backspace || key.delete) {
  //     setInput((current) => current.slice(0, -1));
  //     return;
  //   }
  //   if (key.ctrl && value === 'c') {
  //     const now = Date.now();
  //     if (now - lastCtrlCAt < 800) {
  //       exit();
  //     } else {
  //       setLastCtrlCAt(now);
  //       appendLine('status', 'Press Ctrl+C again to exit.');
  //     }
  //     return;
  //   }
  //   if (value) {
  //     setInput((current) => current + value);
  //   }
  // });

  async function submit(text: string): Promise<void> {
    appendLine('user', text);
    setBusy(true);
    try {
      const commandResult = await handleBuiltinCommand(text, runtime.state, runtime.store);
      if (commandResult === '/exit') {
        exit();
        return;
      }
      if (commandResult !== undefined) {
        appendLine('status', commandResult);
        return;
      }
      await runAgentTurn(text, runtime, appendLine);
    } catch (error) {
      appendLine('error', formatError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        {messages.map((line) => <MessageLine key={line.id} line={line} />)}
      </Box>
      <Box borderStyle="round" paddingX={1}>
        <Text color="cyan">yaca&gt; </Text>
        <Text>{input}</Text>
        {busy ? <Text color="yellow">  ● thinking...</Text> : null}
      </Box>
      <Box>
        <Text color="gray">{statusText}</Text>
      </Box>
    </Box>
  );
}

function MessageLine({ line }: { line: ChatMessage }) {
  const color = line.kind === 'user'
    ? 'cyan'
    : line.kind === 'assistant'
      ? 'white'
      : line.kind === 'tool'
        ? 'yellow'
        : line.kind === 'error'
          ? 'red'
          : 'gray';
  const label = line.kind === 'user'
    ? 'you'
    : line.kind === 'assistant'
      ? 'assistant'
      : line.kind;
  return (
    <Box>
      <Text color={color}>{label}: </Text>
      <Text>{line.text}</Text>
    </Box>
  );
}

async function runAgentTurn(text: string, runtime: ReplRuntime, appendLine: (kind: ChatMessage['kind'], text: string) => void): Promise<void> {
  if (!runtime.state.sessionId) {
    runtime.state.sessionId = (await runtime.store.createSession(text.slice(0, 80))).id;
  }
  const content = await parseUserInput(text, runtime.cwd);
  await runtime.store.appendMessage(runtime.state.sessionId, { role: 'user', content });
  const events = await runtime.createAgent().run(await runtime.store.readMessages(runtime.state.sessionId));
  for (const event of events) {
    appendAgentEvent(event, appendLine);
    if (event.type === 'assistant_text') {
      await runtime.store.appendMessage(runtime.state.sessionId, { role: 'assistant', content: event.text });
    }
  }
}

function appendAgentEvent(event: AgentEvent, appendLine: (kind: ChatMessage['kind'], text: string) => void): void {
  if (event.type === 'assistant_text') {
    appendLine('assistant', event.text);
  } else if (event.type === 'tool_call') {
    appendLine('tool', `⚡ ${event.call.name} ${JSON.stringify(event.call.args)}`);
  } else {
    appendLine('tool', `${event.result.ok ? '✓' : '✗'} ${event.call.name}: ${event.result.content}`);
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
