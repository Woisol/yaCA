# yaCA Code Map

Use this reference after loading `maintaining-yaca` when a task needs concrete code knowledge.

## Runtime Entry

- `apps/index.ts` is both the CLI entry and the root package export surface. It re-exports `AgentLoop`, storage/message conversion helpers, shared UI rendering helpers, and shared types so `@woisol-g/yaca-web` can import them from `@woisol-g/yaca/web-runtime.js`.
- `main()` loads `.env` only in dev, parses `--serve`, `--once`, `--continue`, `--model`, and `--baseurl`, then builds `CliState`, `SessionStore`, `ToolPermissionController`, and `ToolRegistry`.
- `--serve` dynamically imports `@woisol-g/yaca-web/server.js` and `@woisol-g/yaca-web/server/prompt.js`. The Web package is externalized from the root tsup bundle, so do not introduce static imports to it.
- `--once` uses `_run()` and writes assistant text directly. Interactive CLI and Web use `runStream()`.
- Root `package.json` exports both `.` and `./web-runtime.js` to `./dist/index.js`; `test/build-config.test.ts` guards this single-bundle contract.

## Agent Core

- `packages/agent-core/src/agent-loop.ts` is the orchestration loop. It prepends a system prompt, streams one assistant turn, persists assistant history in memory, executes tools, appends tool history, enforces `maxToolRetry`, and delays by `postponeToolCalls`.
- The constructor selects one strategy:
  - `createOpenAICompatibleAssistantTurn()` for standard OpenAI tools/function calling.
  - `createSxmlAssistantTurn()` for text/XML-compatible tool calls.
- `createAssistantHistoryMessage()` differs by mode. OpenAI mode stores assistant `tool_calls`; SXML mode stores raw assistant content because the model emitted XML-like text.
- `createToolHistoryMessage()` also differs by mode. OpenAI mode emits `role: "tool"` with `tool_call_id`; SXML mode feeds tool results back as `role: "user"` content.
- `_run()` is a compatibility wrapper that accumulates SXML assistant events into text; prefer `runStream()` for new UI/runtime flows.

## Model Client

- `packages/agent-core/src/llm/model-client.ts` implements OpenAI-compatible `/chat/completions` with non-streaming and streaming requests.
- `streamChatCompletion()` parses SSE-style lines, accepts `data:` prefixes, stops on `[DONE]`, and silently skips malformed chunks.
- `streamWithTools()` yields `content_delta` and provider reasoning deltas as `think_delta`, while accumulating streamed `tool_calls` by index.
- `toOpenAIMessages()` strips local image metadata before sending image parts to the API.
- `toOpenAIToolDefinition()` currently maps every parameter description to a string property and uses an empty `required` list.
- `FailureModelClient` returns a base-url error when no `baseUrl` is configured, avoiding an immediate crash.

## SXML Tool Calling

- `packages/agent-core/src/llm/sxml-assistant-turn.ts` streams plain model text through `createYacaSxmlParser()`.
- `packages/agent-core/src/parser/sxml-adapter.ts` wraps `@woisol-g/sxml.js` with legal tags `think` and `tool_call`.
- `think` is confirmed at open tag so UI can stream thinking text early; `tool_call` is confirmed at close tag so JSON args are complete before execution.
- `tool_call` content must parse to a JSON object. Invalid JSON becomes a synthetic `parse_tool_call` failure that is returned to the model as a tool result.
- `assignPatchCallIds()` creates call ids for SXML tool calls that do not provide one.
- `collectAssistantText()` joins `text` and `think` events. Be careful: this means changing event types affects final assistant persistence.

## Storage And History

- `ConfigStore` reads `${YACA_HOME:-~/.yaca}/config.json`, writes defaults on load failure, and normalizes legacy fields such as `default_model`, `models`, `maxToolRetry`, top-level `postpone_tool_calls`, and top-level `try_fallback`.
- Default allowed tools are read-only plus `get_tool_hint`: `read_file`, `list_directory`, `stat_path`, `cwd`, `get_tool_hint`.
- `SessionStore` hashes the workspace path to a 16-character SHA-256 prefix and stores sessions under `${YACA_HOME}/sessions/<workspace-hash>/`.
- Each session has `session.json` and `messages.jsonl`; project-level `meta.json` orders visible sessions.
- `deleteSession()` is soft delete: it removes the id from `meta.json`. `cleanDeletedSessions()` removes directories no longer present in metadata.
- Writes use a per-file promise queue plus `.lock` file with stale lock cleanup. Preserve this when changing append/replace semantics.
- `history/agent-events.ts` stores tool calls/results/errors as `role: "tool"` messages with structured `ToolEventContent`.
- `history/model-messages.ts` converts stored history differently for OpenAI vs SXML mode. This is the first place to inspect when resume, rewind, or continued tool conversations break.

## Tools And Permissions

- `packages/agent-tools/src/index.ts` owns `ToolRegistry`, definitions, hint text, and optional registry-level approval.
- `createDefaultTools()` combines `metaTools`, `filesystemTools`, and `systemTools`.
- Filesystem tools use `resolveToolPath(cwd, target)` and therefore allow absolute paths. This is deliberate and covered by tests.
- `write_file` refuses to overwrite non-empty files unless `dangerouslyOverride` is true or `append` is true.
- `replace_file` supports either exact `old_text` replacement or line/column range replacement through `utils/text-range.ts`.
- `remove_file` is the extra safety boundary: it refuses removing outside workspace unless `dangerouslyRemoveOutsideOfWorkspace` is true.
- `exec_command` uses `spawn(command, { shell: true, windowsHide: true })`, captures stdout/stderr, and has a timeout. Command allow-list enforcement is not inside this tool; it happens in `agent-core/src/tools/permissions.ts`.
- `ToolPermissionController.confirm()` hot-reloads config if the file changed, allows trust mode, checks tool allow-list, then checks command allow-list only for `exec_command`.
- Command allow entries are exact match, prefix wildcard ending in `*`, or global `*`.

## CLI UI

- `apps/cli/src/screens/repl-ui.tsx` is the Ink state container. It owns busy state, current input, tool output expansion, trust mode, modal visibility, pending tool approval, and active abort controller.
- `runAgentTurn()` in `apps/cli/src/api/runtime/agent-turn.ts` is the CLI streaming bridge. It persists the user message, converts history for the current mode, applies stream events to UI messages, stores tool events, and appends final assistant text.
- `apps/cli/src/input/shortcuts/index.ts` implements Ctrl+C interrupt/double-exit, Ctrl+O tool output toggle, Shift+Tab trust mode, Esc/double-Esc clear/rewind, history up/down, and Ctrl+V clipboard hint.
- `apps/cli/src/api/chat/path-completions.ts` completes active `@path` tokens, including quoted paths, and prefers relative display paths.
- Shared rendering functions moved to `packages/shared/ui/src/**`; CLI re-exports many helpers for test compatibility.

## Shared UI And Rewind

- `packages/shared/ui/src/chat/messages.ts` mutates visible chat state for assistant deltas, SXML patches, tool calls, tool results, and tool output expansion.
- `packages/shared/ui/src/session/messages.ts` renders stored session history and applies rewind selection.
- `packages/shared/ui/src/format/message-format.ts` reduces full file/image blocks for display and converts reduced markers back to `@path` references during rewind.
- Do not store display-reduced text as model history. Display reduction is UI-only; stored messages must remain model-safe.

## Web UI

- `apps/yaca-web/src/server.ts` starts the HTTP/WebSocket server.
- `server/http.ts` handles REST APIs: sessions, messages, rewind, config, tools, allow-list, health, and static fallback.
- `server/ws.ts` handles `/api/ws`, session resume, chat send, chat abort, and tool confirmation. Each WebSocket connection owns its pending tool approval and active abort controller.
- `server/agent-turn.ts` mirrors the CLI turn bridge but sends full message snapshots to the client after each event.
- `hooks/useYacaWeb.ts` is the browser state container. It loads sessions/config/tools, keeps the URL at `/:sessionId`, builds the Assistant UI external store, sends chat over WebSocket, and updates trust/allow-list through REST.
- `lib/session-route.ts` intentionally uses only one root path segment as the session id; `test/web-session-route.test.ts` guards this.
- `lib/drop-files.ts` turns dropped text files into message text and images into local image parts.

## HTML-First Rendering

- `apps/yaca-web/src/lib/message-rendering.tsx` switches to HTML mode only when text starts with `<body`.
- `packages/llm-html/src/index.ts` creates a stable iframe shell and small payload updates. The shell uses CSP, nonce-scoped script, `postMessage`, `ResizeObserver`, and a channel/token/frame id handshake.
- `createLlmHtmlPayload()` extracts body content, removes unsafe authored HTML, strips scripts/styles/iframes/objects/links/meta/base, removes event/style/srcset attributes, and restricts URLs.
- Preset custom elements are normalized to classed `div`/`span` equivalents so the model may accidentally emit `<note-info>` and still render as `class="note-info"`.
- Streaming mode and final mode share sanitizer logic; final highlighting is separate.
- `packages/llm-html/src/highlight.ts` imports `refractor/all` only in the split highlight entry. `createHighlightedSandboxedHtmlPayload()` dynamically imports it so the lightweight stream path stays small.
- `server/prompt.ts` composes the Web system prompt from `LLM_HTML_PROMPT` and, in SXML-compatible mode, appends XML tool rules and tool hints.

## Build And Package Notes

- Root package uses TypeScript `NodeNext`, strict mode, path aliases, JSX React, and declaration output.
- Root `tsup.config.ts` bundles `apps/index.ts` only, minifies, disables splitting, and externalizes Web package imports.
- `apps/yaca-web` builds with Vite Plus, React compiler Babel preset, server TypeScript build, and a peer dependency on the exact root `@woisol-g/yaca` version.
- `packages/llm-html` is built before root and before Web because Web imports the renderer package.
- Keep `package.json`, `apps/yaca-web/package.json`, and public exports aligned when versioning or release packaging changes.
