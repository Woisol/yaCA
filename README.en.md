<div style="display: flex; flex-direction: column; align-items: center;">
  <p style="white-space: pre; font-family: 'Courier New'; line-height: 1.3;">
        ▄██████▄                    _____
    ▄████████████▄                 / ____|    /\
  ▄████▀     ▀████▄  _   _   __ _ | |        /  \
████          ████  | | | | / _\`|| |       / /\ \
 ██      ▅    ███   | |_| || (_| || |____  / ____ \
  ██          ██     \__, | \__,_| \_____|/_/    \_\
  ███▄      ▄██       __/ |
    ▀████████▀       |___/    yaCA - yet another Coding Agent
  </p>
</div>

# yaCA

<p align="center">
    <a href="https://www.npmjs.com/package/@woisol-g/yaca">
        <img src="https://img.shields.io/npm/v/@woisol-g/yaca.svg?color=blue" alt="npm version" />
    </a>
    <a href="https://nodejs.org/">
        <img src="https://img.shields.io/badge/node->=22-green.svg" alt="node version" />
    </a>
    <a href="https://github.com/Woisol/yaCAgent">
        <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license" />
    </a>
    <a href="https://github.com/Woisol/yaCAgent/stargazers">
        <img src="https://img.shields.io/github/stars/Woisol/yaCAgent.svg" alt="GitHub stars" />
    </a>
    <a href="https://linux.do" alt="LINUX DO">
        <img
            src="https://img.shields.io/badge/LINUX-DO-FFB003.svg?logo=data:image/svg%2bxml;base64,DQo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiPjxwYXRoIGQ9Ik00Ni44Mi0uMDU1aDYuMjVxMjMuOTY5IDIuMDYyIDM4IDIxLjQyNmM1LjI1OCA3LjY3NiA4LjIxNSAxNi4xNTYgOC44NzUgMjUuNDV2Ni4yNXEtMi4wNjQgMjMuOTY4LTIxLjQzIDM4LTExLjUxMiA3Ljg4NS0yNS40NDUgOC44NzRoLTYuMjVxLTIzLjk3LTIuMDY0LTM4LjAwNC0yMS40M1EuOTcxIDY3LjA1Ni0uMDU0IDUzLjE4di02LjQ3M0MxLjM2MiAzMC43ODEgOC41MDMgMTguMTQ4IDIxLjM3IDguODE3IDI5LjA0NyAzLjU2MiAzNy41MjcuNjA0IDQ2LjgyMS0uMDU2IiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZWNlY2VjO2ZpbGwtb3BhY2l0eToxIi8+PHBhdGggZD0iTTQ3LjI2NiAyLjk1N3EyMi41My0uNjUgMzcuNzc3IDE1LjczOGE0OS43IDQ5LjcgMCAwIDEgNi44NjcgMTAuMTU3cS00MS45NjQuMjIyLTgzLjkzIDAgOS43NS0xOC42MTYgMzAuMDI0LTI0LjM4N2E2MSA2MSAwIDAgMSA5LjI2Mi0xLjUwOCIgc3R5bGU9InN0cm9rZTpub25lO2ZpbGwtcnVsZTpldmVub2RkO2ZpbGw6IzE5MTkxOTtmaWxsLW9wYWNpdHk6MSIvPjxwYXRoIGQ9Ik03Ljk4IDcwLjkyNmMyNy45NzctLjAzNSA1NS45NTQgMCA4My45My4xMTNRODMuNDI2IDg3LjQ3MyA2Ni4xMyA5NC4wODZxLTE4LjgxIDYuNTQ0LTM2LjgzMi0xLjg5OC0xNC4yMDMtNy4wOS0yMS4zMTctMjEuMjYyIiBzdHlsZT0ic3Ryb2tlOm5vbmU7ZmlsbC1ydWxlOmV2ZW5vZGQ7ZmlsbDojZjlhZjAwO2ZpbGwtb3BhY2l0eToxIi8+PC9zdmc+" /></a>
            </a>
</p>


yaCA is a local coding agent. It connects to models through an OpenAI-compatible `/chat/completions` API and provides a terminal REPL, one-shot tasks, an optional Web UI, persisted sessions, tool permission control, filesystem tools, command execution, and an XML/SXML tool-call compatibility mode for models without reliable native function calling.

> Disclaimer: this project is primarily for learning, research, and teaching practice. It is not a product commitment, commercial service, or technical support guarantee. Use it at your own risk.

## Quick Start

```bash
pnpm i -g @woisol-g/yaca
yaca
```

Install the Web UI package if you want to use the browser interface:

```bash
pnpm i -g @woisol-g/yaca-web
yaca --serve 3000
```

On first launch, configure your model with `/model`, `/baseurl`, and `/apikey`, or edit `~/.yaca/config.json` directly.

```bash
yaca --model qwen2.5-vl-7b --baseurl http://127.0.0.1:11434/v1
yaca --once "read package.json and summarize this project"
yaca --continue
```

Environment variables can also override the config:

```bash
YACA_MODEL=qwen2.5-vl-7b
YACA_BASE_URL=http://127.0.0.1:11434/v1
YACA_API_KEY=your-api-key
```

## Features

- OpenAI-compatible model client with plain text, streaming output, and standard tools/function calling.
- XML/SXML tool-call compatibility mode for models or gateways that do not reliably support native tools.
- Local filesystem tools: read, write, replace, search, move, delete, and inspect paths.
- Command execution through a separate command allow-list.
- Workspace-scoped persisted sessions with resume, continue, rename, soft delete, and cleanup.
- Ink-based terminal UI with tool confirmation, rewind, input history, path completion, and trust mode.
- Optional Web UI with session management, file drag-and-drop, HTML-first output rendering, and streaming iframe previews.

## Built-in Commands

```text
/help                  Show help
/model <name>          Set the current model
/baseurl <url>         Set the OpenAI-compatible base URL
/apikey <key>          Set the API key
/clear                 Clear context and start a new session
/resume [session-id]   List sessions or resume one by id
/continue              Continue the most recent session
/rename <name>         Rename the current session
/delete                Soft delete the current session
/clean                 Permanently remove soft-deleted sessions
/tool                  Open tool allow-list selector
/exit                  Exit REPL
```

`/delete` only removes the session from the current workspace `meta.json`; the session directory remains on disk. Only `/clean` permanently removes session directories that are no longer listed in `meta.json`.

## Shortcuts

- `Ctrl+C`: press twice while idle to exit; interrupt the current task while running.
- `Ctrl+O`: toggle tool output expansion.
- `Shift+Tab`: toggle trust/untrust mode.
- `Esc`: clear input; press twice to open rewind.
- `Up/Down`: browse input history.
- `Tab`: complete paths.

## Configuration

The default config file is:

```text
~/.yaca/config.json
```

Use `YACA_HOME` to change the config and session root directory. Full config example:

```json
{
  "model": "qwen2.5-vl-7b",
  "base_url": "http://127.0.0.1:11434/v1",
  "api_key": "sk-your-api-key",
  "max_turns": 20,
  "max_tool_retry": 5,
  "tool_call": {
    "tool_call_compatible": false,
    "postpone_tool_calls": 2,
    "try_fallback": false,
    "allow": {
      "tools": ["read_file", "list_directory", "stat_path", "cwd", "get_tool_hint"],
      "commands": []
    }
  }
}
```

Common fields:

- `model`: model name.
- `base_url`: OpenAI-compatible API endpoint. yaCA calls `${base_url}/chat/completions`.
- `api_key`: optional; can also be supplied through `YACA_API_KEY`.
- `max_turns`: maximum model/tool loop count for one task.
- `max_tool_retry`: maximum consecutive tool failures.
- `tool_call.tool_call_compatible`: enable XML/SXML tool-call compatibility mode.
- `tool_call.postpone_tool_calls`: delay after tool calls to reduce frequent request risk.
- `tool_call.try_fallback`: try fallback parsing when model output is irregular.
- `tool_call.allow.tools`: tools allowed by default.
- `tool_call.allow.commands`: commands allowed for execution. Supports exact matches, prefix patterns such as `pnpm *`, and global `"*"`.

## Tool Permissions

By default, yaCA only allows a low-risk read-only tool set:

```json
["read_file", "list_directory", "stat_path", "cwd", "get_tool_hint"]
```

When the model requests a tool that is not allowed, the CLI asks for confirmation. Approval only applies to that single call and is not written to the allow-list. Use `/tool` to manage tool and command allow-lists.

Command execution is handled by `exec_command` and has its own command allow-list:

```json
{
  "tool_call": {
    "allow": {
      "tools": ["exec_command"],
      "commands": ["pnpm *", "node --version"]
    }
  }
}
```

## tool_call_compatible

By default, yaCA uses standard OpenAI tools/function calling. If your model or gateway does not reliably support tools, enable compatibility mode:

```json
{
  "tool_call": {
    "tool_call_compatible": true
  }
}
```

In this mode, yaCA asks the model to emit XML-style tool calls:

```xml
<tool_call name="read_file">{"path":"package.json"}</tool_call>
```

yaCA parses this stream, extracts the tool name and JSON arguments, executes the tool, and feeds the result back to the model. The parser uses `@woisol-g/sxml.js`. This mode is useful with OpenAI-compatible aggregators, proxies, and smaller models.

## Sessions

Sessions are stored per workspace:

```text
${YACA_HOME:-~/.yaca}/sessions/<workspace-hash>/
```

Common session operations:

- `/resume`: list sessions for the current workspace.
- `/resume <session-id>`: resume a specific session.
- `/continue` or `yaca --continue`: continue the most recent session.
- `/rename <name>`: rename the current session.
- `/delete`: soft delete the current session.
- `/clean`: permanently clean directories for soft-deleted sessions.

## Web UI

The Web UI lives in the separate `@woisol-g/yaca-web` package. After installing it, start it through the CLI:

```bash
yaca --serve 3000
```

The Web UI provides:

- Native history session routing: `/:sessionId`.
- Session sidebar create, select, rename, and soft delete.
- Automatic session naming from the first message.
- Markdown rendering, code highlighting, and file drag-and-drop input.
- HTML-first LLM output rendering through a sandboxed iframe with streaming updates, adaptive height, and dark theme support.

See `apps/yaca-web/README.md` for Web package details.

## Development

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

Local development commands:

```bash
pnpm dev:cli
pnpm dev:web
pnpm --filter @woisol-g/yaca-web run build
```

If this project is useful to you, a Star is appreciated.
