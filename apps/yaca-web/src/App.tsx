import { AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive, ThreadPrimitive, useExternalStoreRuntime } from '@assistant-ui/react';
import { Check, ChevronsLeft, Hammer, Menu, Plus, Send, Shield, ShieldAlert, Terminal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import './App.css';
import { useYacaWeb, type PendingToolConfirm } from './hooks/useYacaWeb.js';
import type { RuntimeInfo, SessionMeta, ToolDefinitionView } from './api/types.js';

function App() {
  const yaca = useYacaWeb();
  const runtime = useExternalStoreRuntime(yaca.assistantStore);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="app-shell">
        <SessionSidebar
          open={sidebarOpen}
          sessions={yaca.sessions}
          activeSessionId={yaca.sessionId}
          onClose={() => setSidebarOpen(false)}
          onCreate={() => void yaca.createSession()}
          onSelect={(id) => {
            setSidebarOpen(false);
            void yaca.selectSession(id);
          }}
        />
        <main className="workspace">
          <header className="mobile-topbar">
            <button className="icon-button" type="button" aria-label="Open sessions" onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
            <span>yaCA</span>
          </header>
          <ThreadView />
          <ComposerArea busy={yaca.busy} />
          <StatusLine
            connected={yaca.connected}
            runtime={yaca.runtime}
            tools={yaca.tools}
            allowTools={yaca.allowTools}
            allowCommands={yaca.allowCommands}
            toolsOpen={toolsOpen}
            onToolsOpenChange={setToolsOpen}
            onAllowChange={(tools, commands) => void yaca.updateAllow(tools, commands)}
            onTrustChange={(trusted) => void yaca.updateTrustMode(trusted)}
          />
        </main>
        {yaca.pendingToolConfirm ? <ToolConfirmDialog pending={yaca.pendingToolConfirm} onResolve={yaca.resolveToolConfirm} /> : null}
        {yaca.error ? <div className="toast" role="status">{yaca.error}</div> : null}
      </div>
    </AssistantRuntimeProvider>
  );
}

function SessionSidebar({
  open,
  sessions,
  activeSessionId,
  onClose,
  onCreate,
  onSelect
}: {
  open: boolean;
  sessions: SessionMeta[];
  activeSessionId?: string;
  onClose(): void;
  onCreate(): void;
  onSelect(id: string): void;
}) {
  return (
    <>
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <div className="brand">yaCA</div>
            <div className="sidebar-subtitle">sessions</div>
          </div>
          <button className="icon-button desktop-hidden" type="button" aria-label="Close sessions" onClick={onClose}>
            <ChevronsLeft size={18} />
          </button>
        </div>
        <button className="new-session" type="button" onClick={onCreate}>
          <Plus size={16} /> New session
        </button>
        <nav className="session-list" aria-label="Conversation history">
          {sessions.map((session) => (
            <button
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              key={session.id}
              type="button"
              onClick={() => onSelect(session.id)}
            >
              <span>{session.name || 'New session'}</span>
              <small>{formatSessionTime(session.updated_at)} · {session.message_count} msg</small>
            </button>
          ))}
          {sessions.length === 0 ? <div className="empty-sidebar">No sessions yet.</div> : null}
        </nav>
      </aside>
      {open ? <button className="scrim" type="button" aria-label="Close sessions" onClick={onClose} /> : null}
    </>
  );
}

function ThreadView() {
  return (
    <ThreadPrimitive.Root className="thread-root">
      <ThreadPrimitive.Viewport className="thread-viewport">
        <ThreadPrimitive.Empty>
          <div className="empty-thread">
            <strong>YACA Web ready.</strong>
            <span>Start a session or resume one from the sidebar.</span>
          </div>
        </ThreadPrimitive.Empty>
        <ThreadPrimitive.Messages components={{ Message: ChatBubble }} />
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}

function ChatBubble() {
  return (
    <MessagePrimitive.Root className="message">
      <MessagePrimitive.If user>
        <div className="message-bubble user"><MessagePrimitive.Parts /></div>
      </MessagePrimitive.If>
      <MessagePrimitive.If assistant>
        <div className="message-bubble assistant"><MessagePrimitive.Parts /></div>
      </MessagePrimitive.If>
    </MessagePrimitive.Root>
  );
}

function ComposerArea({ busy }: { busy: boolean }) {
  return (
    <ComposerPrimitive.Root className="composer">
      <ComposerPrimitive.Input className="composer-input" placeholder="Message yaCA..." autoFocus rows={3} />
      <div className="composer-actions">
        <ComposerPrimitive.Cancel asChild>
          <button className="secondary-button" type="button" disabled={!busy}>
            <X size={16} /> Stop
          </button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <button className="send-button" type="button">
            <Send size={16} /> Send
          </button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
}

function StatusLine({
  connected,
  runtime,
  tools,
  allowTools,
  allowCommands,
  toolsOpen,
  onToolsOpenChange,
  onAllowChange,
  onTrustChange
}: {
  connected: boolean;
  runtime?: RuntimeInfo;
  tools: ToolDefinitionView[];
  allowTools: string[];
  allowCommands: string[];
  toolsOpen: boolean;
  onToolsOpenChange(open: boolean): void;
  onAllowChange(tools: string[], commands: string[]): void;
  onTrustChange(trusted: boolean): void;
}) {
  const trusted = runtime?.trustMode ?? false;
  return (
    <footer className="status-line">
      <span className={`connection-dot ${connected ? 'online' : ''}`} />
      <span className="status-chip">{runtime?.model ?? 'model'}</span>
      <span className="status-chip truncate">{runtime?.baseUrl ?? 'baseurl'}</span>
      <span className="status-chip truncate">{runtime?.cwd ?? 'cwd'}</span>
      <div className="status-spacer" />
      <div className="tool-popover-wrap">
        <button className="status-button" type="button" onClick={() => onToolsOpenChange(!toolsOpen)}>
          <Hammer size={14} /> Tools
        </button>
        {toolsOpen ? (
          <ToolPopover
            tools={tools}
            allowTools={allowTools}
            allowCommands={allowCommands}
            onChange={onAllowChange}
          />
        ) : null}
      </div>
      <button
        className={`trust-toggle ${trusted ? 'trusted' : ''}`}
        type="button"
        aria-pressed={trusted}
        onClick={() => onTrustChange(!trusted)}
      >
        {trusted ? <ShieldAlert size={14} /> : <Shield size={14} />}
        {trusted ? 'trust' : 'untrust'}
      </button>
    </footer>
  );
}

function ToolPopover({
  tools,
  allowTools,
  allowCommands,
  onChange
}: {
  tools: ToolDefinitionView[];
  allowTools: string[];
  allowCommands: string[];
  onChange(tools: string[], commands: string[]): void;
}) {
  const commandText = useMemo(() => allowCommands.join('\n'), [allowCommands]);
  function toggleTool(tool: string) {
    const nextTools = allowTools.includes(tool)
      ? allowTools.filter((item) => item !== tool)
      : [...allowTools, tool];
    onChange(nextTools, allowCommands);
  }
  return (
    <div className="tool-popover">
      <div className="popover-title">Allowed tools</div>
      <div className="tool-list">
        {tools.map((tool) => (
          <label className="tool-row" key={tool.name}>
            <input type="checkbox" checked={allowTools.includes(tool.name)} onChange={() => toggleTool(tool.name)} />
            <span>
              <strong>{tool.name}</strong>
              <small>{tool.description}</small>
            </span>
          </label>
        ))}
      </div>
      <label className="command-allow">
        <span>Allowed commands</span>
        <textarea
          value={commandText}
          placeholder={'pnpm *\ngit status'}
          onChange={(event) => onChange(allowTools, event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
        />
      </label>
    </div>
  );
}

function ToolConfirmDialog({ pending, onResolve }: { pending: PendingToolConfirm; onResolve(approved: boolean): void }) {
  return (
    <div className="modal-backdrop">
      <div className="confirm-dialog" role="dialog" aria-modal="true">
        <div className="confirm-icon"><Terminal size={20} /></div>
        <h2>{pending.kind === 'command' ? 'Allow command execution?' : `Allow tool call ${pending.call.name}?`}</h2>
        <pre>{pending.kind === 'command' ? String(pending.call.args.command ?? '') : JSON.stringify(pending.call.args, null, 2)}</pre>
        <div className="confirm-actions">
          <button className="secondary-button" type="button" onClick={() => onResolve(false)}>
            <X size={16} /> No
          </button>
          <button className="send-button" type="button" onClick={() => onResolve(true)}>
            <Check size={16} /> Yes
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSessionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default App;
