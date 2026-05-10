import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, render, Text, useApp, type RenderOptions } from 'ink';
import { handleBuiltinCommand, parseUserInput, type AgentLoop, type CliState, type SessionStore, type ToolPermissionController } from '@yaca/agent-core';
import type { AgentEvent, ToolCall } from '@yaca/types';
import { preserveInputAfterCurrentKeypress } from '../input/preserve.js';
import { useKeyboardShortcuts } from '../input/registry.js';
import { createReplShortcuts, type ReplShortcutContext } from '../input/shortcuts/index.js';
import { ChatArea, ChatMessage } from './home/chat/ChatArea.js';
import { Input } from './home/action/Input.js';
import { StatusBar } from './home/action/StatusBar.js';
import { Resume } from './home/pop/Resume.js';
import { Rewind } from './home/pop/Rewind.js';
import { ToolSelect } from './home/pop/ToolSelect.js';
import { ConfirmToolCall } from './home/pop/ConfirmToolCall.js';
import { SessionMeta } from '@yaca/agent-core/storage/session-store.js';
import {
  appendChatLine,
  appendAssistantEvent,
  appendAssistantDelta,
  replaceAssistantText,
  applyAssistantEventPatch,
  applyToolCall,
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
  reduceMessageFile,
  formatStoredMessageContent,
} from '../api/index.js';

// Re-export for test compatibility
export {
  appendChatLine,
  appendAssistantEvent,
  appendAssistantDelta,
  replaceAssistantText,
  applyAssistantEventPatch,
  applyToolCall,
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
  tools?: { definitions?(): Array<{ name: string }> };
  toolPermissions?: ToolPermissionController;
  createAgent(): AgentLoop;
};

export const replRenderOptions: RenderOptions = {
  exitOnCtrlC: false
};

export function startInkRepl(runtime: ReplRuntime): void {
  render(<YacaRepl runtime={runtime} />, replRenderOptions);
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
  const [showToolSelect, setShowToolSelect] = useState(false);
  const [showPathCompletion, setShowPathCompletion] = useState(false);
  const [allowedTools, setAllowedTools] = useState(runtime.state.config.tool_call.allow.tools);
  const [trustMode, setTrustMode] = useState(runtime.state.trustMode ?? false);
  const [pendingToolApproval, setPendingToolApproval] = useState<{
    call: ToolCall;
    kind: 'tool' | 'command';
    resolve(approved: boolean): void;
  } | null>(null);
  const [resumeSessions, setResumeSessions] = useState<SessionMeta[]>([]);
  const activeTurnControllerRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { kind: 'status', text: 'YACA CLI ready. Send a message to create a session, or type /resume to browse history.' }
  ]);
  const userMessages = useMemo(() => {
    return messages
      .filter((msg) => msg.kind === 'user')
      .map((msg) => msg.text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0);
  }, [messages]);

  useEffect(() => {
    setAllowedTools(runtime.state.config.tool_call.allow.tools);
  }, [runtime.state.config]);

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
    shortcutsEnabled: !(showRewind || showResume || showToolSelect || showPathCompletion || !!pendingToolApproval),
    now: Date.now,
    setInput,
    setBusy,
    setUserMessageHistoryIndex,
    setUserMessageDraft,
    setLastCtrlCAt,
    setLastEscapeAt,
    appendLine,
    abortCurrentTurn: () => {
      activeTurnControllerRef.current?.abort();
    },
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
    toggleTrustMode: () => {
      setTrustMode((current) => {
        const next = !current;
        runtime.state.trustMode = next;
        appendLine('status', next ? 'Trust mode enabled. Tool calls will run without prompts.' : 'Trust mode disabled. Tool calls require allow-list or confirmation.');
        return next;
      });
    },
    openRewind: () => {
      setShowRewind(true);
    },
    openResume: () => {
      void openResume();
    },
    openToolSelect: () => {
      setShowToolSelect(true);
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
    setBusy(true);
    try {
      await runtime.toolPermissions?.refreshConfigIfChanged();
      const trimmed = text.trim();
      if (trimmed.startsWith('/')) {
        appendLine('user', reduceMessageFile(text));
        await handleSlashCommand(trimmed);
        return;
      }
      const content = await parseUserInput(text, runtime.cwd);
      appendLine('user', reduceMessageFile(formatStoredMessageContent(content)));
      const controller = new AbortController();
      activeTurnControllerRef.current = controller;
      try {
        await runAgentTurn(text, runtime, appendLine, setMessages, showToolOutput, { signal: controller.signal, userContent: content });
      } finally {
        if (activeTurnControllerRef.current === controller) {
          activeTurnControllerRef.current = null;
        }
      }
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
    if (trimmed === '/tool') {
      setShowToolSelect(true);
      return;
    }
    const sessionIdBeforeCommand = runtime.state.sessionId;
    const commandResult = await handleBuiltinCommand(trimmed, runtime.state, runtime.store);
    if (commandResult === '/exit') {
      exit();
      return;
    }
    if (commandResult === '/tool') {
      setShowToolSelect(true);
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
    await runtime.toolPermissions?.refreshConfigIfChanged();
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

  async function confirmToolCall(call: ToolCall): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      setPendingToolApproval({ call, kind: 'tool', resolve });
    });
  }

  async function confirmCommandCall(call: ToolCall): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      setPendingToolApproval({ call, kind: 'command', resolve });
    });
  }

  function resolvePendingToolApproval(approved: boolean): void {
    const pending = pendingToolApproval;
    if (!pending) return;
    pending.resolve(approved);
    setPendingToolApproval(null);
  }

  function toggleAllowedTool(tool: string): void {
    const nextAllowedTools = allowedTools.includes(tool)
      ? allowedTools.filter((item) => item !== tool)
      : [...allowedTools, tool];
    setAllowedTools(nextAllowedTools);
    runtime.state.config.tool_call.allow.tools = nextAllowedTools;
    void runtime.state.configStore.save(runtime.state.config).then(async () => {
      runtime.state.configMtimeMs = await runtime.state.configStore.getMtimeMs();
    });
  }

  const availableTools = useMemo(() => {
    return runtime.tools?.definitions?.().map((tool) => tool.name) ?? [];
  }, [runtime.tools]);

  runtime.state.trustMode = trustMode;
  runtime.state.toolCallConfirm = async ({ kind, name, args }) => {
    const call = { name, args };
    return kind === 'command' ? confirmCommandCall(call) : confirmToolCall(call);
  };

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
              cwd={runtime.cwd}
              focus={!busy && !(showRewind || showResume || showToolSelect || !!pendingToolApproval)}
              input={input}
              setInput={updateInput}
              onCompletionOpenChange={setShowPathCompletion}
              onSubmit={submitInput}
            />
            <StatusBar busy={busy} model={runtime.state.model} cwd={runtime.cwd} trustMode={trustMode} />
        </>
      )}
      {showResume ? (
        <Resume sessions={resumeSessions} onSessionSelect={(sessionId) => {
          void resumeFromPicker(sessionId);
        }} onQuit={() => {
            setShowResume(false);
          }} />
      ) : null}
      {pendingToolApproval ? (
        <ConfirmToolCall
          title={pendingToolApproval.kind === 'command' ? 'Allow command execution?' : `Allow tool call ${pendingToolApproval.call.name}?`}
          detail={pendingToolApproval.kind === 'command' ? String(pendingToolApproval.call.args.command ?? '') : JSON.stringify(pendingToolApproval.call.args)}
          onSelect={resolvePendingToolApproval}
        />
      ) : null}
      {showToolSelect ? (
        <ToolSelect
          tools={availableTools}
          allowTools={allowedTools}
          onSelect={toggleAllowedTool}
          onQuit={() => setShowToolSelect(false)}
        />
      ) : null}
    </Box>
  );
}
