---
name: maintaining-yaca
description: "Use when maintaining this yaCA repository: CLI, agent loop, OpenAI-compatible model client, XML/SXML tool calling, tool permissions, session storage, Ink REPL, Web UI, llm-html rendering, pnpm workspace packaging, tests, or releases."
---

# Maintaining yaCA

## Overview

yaCA is a pnpm workspace for a local coding agent with two frontends: Ink CLI and optional Web UI. The core runtime is shared through `agent-core`, `agent-tools`, `shared/types`, and `shared/ui`; keep behavior changes in the shared layer unless the difference is truly presentation-specific.

For concrete file paths, data flows, and module-by-module maintenance notes, read `references/code-map.md` after this file.

## Repository Map

| Area | Main files | Use when |
| --- | --- | --- |
| Runtime wiring | `apps/index.ts` | CLI args, `--once`, `--serve`, exports for `@woisol-g/yaca/web-runtime.js` |
| Agent core | `packages/agent-core/src/**` | Agent loop, model requests, SXML adapter, config/session stores, permission controller |
| Tool registry | `packages/agent-tools/src/**` | Filesystem tools, command execution, tool definitions/hints |
| CLI UI | `apps/cli/src/**` | Ink REPL, shortcuts, slash commands, path completion, rewind/tool popups |
| Shared UI/history | `packages/shared/ui/src/**` | Rendering persisted messages, tool cards, rewind transformations shared by CLI/Web |
| Web UI | `apps/yaca-web/src/**` | HTTP/WebSocket server, Assistant UI adapter, session routes, tool confirmation dialog |
| HTML-first renderer | `packages/llm-html/src/**` | Sandboxed iframe shell, payload sanitizer, preset classes, lazy code highlighting |
| Package/build | `package.json`, `tsconfig.json`, `tsup.config.ts`, `apps/yaca-web/package.json` | Exports, path aliases, release/build behavior |

## Maintenance Workflow

1. Inspect `git status --short` first and do not overwrite unrelated user changes.
2. Read this file and then the relevant section of `references/code-map.md`. If text is garbled, re-read with UTF-8.
3. For behavior changes, add or update a focused test first. Root tests use Node's built-in test runner with `tsx`.
4. Keep path aliases in sync with `tsconfig.json`; imports generally use `.js` suffixes because the project uses `moduleResolution: "NodeNext"`.
5. Prefer package boundaries already in place. Put shared runtime behavior in `agent-core`, executable tools in `agent-tools`, terminal presentation in `apps/cli`, browser/server presentation in `apps/yaca-web`.
6. After edits, run the relevant targeted test, then `pnpm run typecheck` or `pnpm test` when the blast radius crosses package boundaries.

## Core Data Flow

User input enters through CLI `submit()` or Web `chat.send`, then:

1. `parseUserInput()` expands `@path` text/image references into model-ready content.
2. `SessionStore.appendMessage()` persists the user message under the workspace hash.
3. `storedChatMessagesToModelMessages()` converts stored tool events differently for OpenAI tools vs SXML-compatible mode.
4. `AgentLoop.runStream()` selects `createOpenAICompatibleAssistantTurn()` or `createSxmlAssistantTurn()`.
5. Tool calls pass through `createToolPermissionController().confirm()` before `ToolRegistry.execute()`.
6. Tool events are persisted through `createStoredAgentEventMessage()` and rendered through shared UI helpers.
7. Assistant text is reconstructed from streamed deltas or SXML assistant events and appended as the final assistant message.

If a change touches any step, check both storage history conversion and UI rendering. These bugs usually appear as broken resume/rewind/tool cards rather than immediate type errors.

## Verification

| Change | Start with | Broader check |
| --- | --- | --- |
| Agent loop/tool calling | `node --import tsx --test test/agent.test.ts test/xml-parser.test.ts` | `pnpm test` |
| Model client/OpenAI payloads | `node --import tsx --test test/model-client.test.ts` | `pnpm test` |
| Config/session storage | `node --import tsx --test test/config-store.test.ts test/session-store.test.ts` | `pnpm test` |
| Tool registry/filesystem/permissions | `node --import tsx --test test/tools.test.ts test/tool-permissions.test.ts` | `pnpm test` |
| CLI input, commands, REPL | `node --import tsx --test test/commands.test.ts test/repl-ui.test.ts test/keyboard-shortcuts.test.ts` | `pnpm test` |
| Web session/rendering | `node --import tsx --test test/web-message-rendering.test.ts test/web-session-route.test.ts` | `pnpm --filter @woisol-g/yaca-web run build` |
| Web drag/drop helpers | `node --import tsx --test apps/yaca-web/src/lib/drop-files.test.ts` | `pnpm --filter @woisol-g/yaca-web run build` |
| Package/build wiring | `node --import tsx --test test/build-config.test.ts` | `pnpm run build` |

Use `pnpm run typecheck` when types, exports, package boundaries, or path aliases change. Use `pnpm run build` before release or when touching `tsup.config.ts`, package exports, `apps/index.ts`, `packages/llm-html`, or `apps/yaca-web` build wiring.

## Project Constraints

- Node engine is `>=22`; package manager is `pnpm@11.0.9`.
- Root package builds `@woisol-g/llm-html` first, then bundles only `apps/index.ts` with tsup. Both `.` and `./web-runtime.js` export `./dist/index.js`.
- `@woisol-g/yaca-web` is dynamically imported by the CLI and externalized from the root bundle; keep `@woisol-g/yaca-web/server.js` and `@woisol-g/yaca-web/server/prompt.js` exports compatible with `apps/index.ts`.
- Standard OpenAI tools and XML/SXML-compatible tools are both supported. Do not fix one mode without checking the corresponding history messages and tests.
- Tool permission has two layers: configured allow-list/trust mode in `agent-core`, and registry approval in `agent-tools`. Preserve both.
- Sessions live under `${YACA_HOME:-~/.yaca}/sessions/<workspace-hash>/`; delete is soft unless clean logic explicitly removes orphaned directories.
- Web UI shares the same `SessionStore`, config, tool registry, and permission controller as CLI. Avoid duplicating core behavior in Web-only code.
- HTML-first rendering must stay sandboxed: no authored scripts/styles/event handlers/unsafe URLs should pass through.
- `read_file`, `write_file`, `list_directory`, and `search_files` intentionally allow absolute paths; `remove_file` refuses deleting outside the workspace unless explicitly opted in.
- `ConfigStore.normalizeConfig()` preserves legacy config fields. Migration changes need tests for old and new shapes.

## Common Mistakes

- Forgetting root tests when a Web helper changes shared message rendering.
- Adding a tool without updating definitions, hints, permission behavior, and tests.
- Breaking rewind/session history by changing display reduction instead of stored message conversion.
- Using browser-only APIs in server code or Node-only APIs in React components.
- Editing generated `dist/`, logs, `.tmp-yaca-home*`, or `node_modules` instead of source.
- Changing package versions/exports in one package without checking peer dependency and root dynamic import expectations.
- Treating SXML tool calls like OpenAI tool messages. In compatible mode, tool results are fed back as user-visible text history, not OpenAI `role: "tool"` messages.
