import React, { useMemo, useState } from 'react';
import { Box, render, Text, useApp } from 'ink';
import { handleBuiltinCommand, type AgentLoop, type CliState, type SessionStore } from '@yaca/agent-core';
import type { AgentEvent } from '@yaca/types';
import { preserveInputAfterCurrentKeypress } from '../input/preserve.js';
import { useKeyboardShortcuts } from '../input/registry.js';
import { createReplShortcuts, type ReplShortcutContext } from '../input/shortcuts/index.js';
import { ChatArea, ChatMessage } from './home/chat/ChatArea.js';
import { Input } from './home/action/Input.js';
import { StatusBar } from './home/action/StatusBar.js';
import { Resume } from './home/action/Resume.js';
import { Rewind } from './home/action/Rewind.js';
import { SessionMeta } from '@yaca/agent-core/storage/session-store.js';
import {
  appendChatLine,
  appendAssistantEvent,
  appendAssistantDelta,
  replaceAssistantText,
  applyAssistantEventPatch,
  applyToolResult,
  setToolOutputExpanded,
  renderSessionMessages,
  appendStoredToolMessage,
  applyRewindSelection,
  createStoredAgentEventMessage,
  formatError,
  runAgentTurn,
  isSessionSwitchCommand,
  chatMessagesToStored,
} from '../api/index.js';

// Re-export for test compatibility
export {
  appendChatLine,
  appendAssistantEvent,
  appendAssistantDelta,
  replaceAssistantText,
  applyAssistantEventPatch,
  applyToolResult,
  setToolOutputExpanded,
  renderSessionMessages,
  applyRewindSelection,
  createStoredAgentEventMessage,
} from '../api/index.js';
export type { ChatMessage } from '../api/message-utils.js';

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
  const [showToolOutput, setShowToolOutput] = useState(false);
  const [lastCtrlCAt, setLastCtrlCAt] = useState(0);
  const [lastEscapeAt, setLastEscapeAt] = useState(0);
  const [userMessageHistoryIndex, setUserMessageHistoryIndex] = useState<number | null>(null);
  const [userMessageDraft, setUserMessageDraft] = useState('');
  const [showRewind, setShowRewind] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [resumeSessions, setResumeSessions] = useState<SessionMeta[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { kind: 'status', text: 'YACA CLI ready. Send a message to create a session, or type /resume to browse history.' }
  ]);
  const userMessages = useMemo(() => {
    return messages
      .filter((msg) => msg.kind === 'user')
      .map((msg) => msg.text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0);
  }, [messages]);

  const appendLine = (kind: string, text: string) => {
    setMessages((current) => appendChatLine(current, kind as ChatMessage['kind'], text));
  };

  const shortcuts = useMemo(() => createReplShortcuts(), []);
  const shortcutContext: ReplShortcutContext = {
    input,
    busy,
    userMessages,
    userMessageHistoryIndex,
    userMessageDraft,
    lastCtrlCAt,
    lastEscapeAt,
    shortcutsEnabled: !(showRewind || showResume),
    now: Date.now,
    setInput,
    setBusy,
    setUserMessageHistoryIndex,
    setUserMessageDraft,
    setLastCtrlCAt,
    setLastEscapeAt,
    appendLine,
    preserveInputAfterShortcut: () => {
      preserveInputAfterCurrentKeypress(input, setInput);
    },
    toggleToolOutput: () => {
      setShowToolOutput((current) => {
        const next = !current;
        setMessages((messages) => setToolOutputExpanded(messages, next));
        return next;
      });
    },
    openRewind: () => {
      setShowRewind(true);
    },
    openResume: () => {
      void openResume();
    },
    submit: (text) => {
      void submit(text);
    },
    exit
  };
  useKeyboardShortcuts(shortcutContext, shortcuts);

  function updateInput(value: string | ((current: string) => string)): void {
    setInput((current) => typeof value === 'function' ? value(current) : value);
    setUserMessageHistoryIndex(null);
  }

  function submitInput(text: string): void {
    const submitted = text.trim();
    setInput('');
    setUserMessageHistoryIndex(null);
    setUserMessageDraft('');
    if (submitted.length > 0) {
      void submit(submitted);
    }
  }

  async function submit(text: string): Promise<void> {
    appendLine('user', text);
    setBusy(true);
    try {
      const trimmed = text.trim();
      if (trimmed.startsWith('/')) {
        await handleSlashCommand(trimmed);
        return;
      }
      await runAgentTurn(text, runtime, appendLine, setMessages, showToolOutput);
    } catch (error) {
      appendLine('error', formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSlashCommand(trimmed: string): Promise<void> {
    if (trimmed === '/rewind') {
      setShowRewind(true);
      return;
    }
    if (trimmed === '/resume') {
      await openResume();
      return;
    }
    const sessionIdBeforeCommand = runtime.state.sessionId;
    const commandResult = await handleBuiltinCommand(trimmed, runtime.state, runtime.store);
    if (commandResult === '/exit') {
      exit();
      return;
    }
    if (commandResult === undefined) {
      const cmd = trimmed.split(/\s+/)[0];
      appendLine('error', `Unknown command: ${cmd}`);
      return;
    }
    if (runtime.state.sessionId && runtime.state.sessionId !== sessionIdBeforeCommand && isSessionSwitchCommand(trimmed)) {
      const history = await runtime.store.readMessages(runtime.state.sessionId);
      setMessages(renderSessionMessages(history));
    }
    appendLine('status', commandResult);
  }

  async function openResume(): Promise<void> {
    setResumeSessions(await runtime.store.listSessions());
    setShowResume(true);
  }

  async function resumeFromPicker(sessionId: string): Promise<void> {
    if (!sessionId) return;
    const session = await runtime.store.resumeSession(sessionId);
    runtime.state.sessionId = session.id;
    setMessages(renderSessionMessages(await runtime.store.readMessages(session.id)));
    setShowResume(false);
  }

  async function handleRewind(selectedIndex: number): Promise<void> {
    const result = applyRewindSelection(messages, selectedIndex);
    setMessages(result.messages);
    setUserMessageHistoryIndex(null);
    setUserMessageDraft('');
    setInput((current) => current || result.input);
    // setInput("abc");
    setShowRewind(false);
    if (runtime.state.sessionId) {
      await runtime.store.replaceMessages(runtime.state.sessionId, result.storedMessages);
    }
  }

  return (
    <Box flexDirection="column">
      {showRewind ? (
        <Rewind messages={messages} onMessageSelect={(selectedIndex) => {
          void handleRewind(selectedIndex);
        }} onQuit={() => {
          setShowRewind(false);
        }} />
      ) : (
        <>
            <ChatArea messages={messages} hasSession={!!runtime.state.sessionId} />
            <Input
              focus={!busy && !(showRewind || showResume)}
              input={input}
              setInput={updateInput}
              onSubmit={submitInput}
            />
            <StatusBar busy={busy} model={runtime.state.model} cwd={runtime.cwd} />
        </>
      )}
      {showResume ? (
        <Resume sessions={resumeSessions} onSessionSelect={(sessionId) => {
          void resumeFromPicker(sessionId);
        }} onQuit={() => {
            setShowResume(false);
          }} />
      ) : null}
    </Box>
  );
}
