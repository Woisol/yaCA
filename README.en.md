```text
                      ______    ______
                     /      \  /      \
 __    __   ______  |  $$$$$$\|  $$$$$$\
|  \  |  \ |      \ | $$   \$$| $$__| $$
| $$  | $$  \$$$$$$\| $$      | $$    $$
| $$  | $$ /      $$| $$   __ | $$$$$$$$
| $$__/ $$|  $$$$$$$| $$__/  \| $$  | $$
 \$$    $$ \$$    $$ \$$    $$| $$  | $$
 _\$$$$$$$  \$$$$$$$  \$$$$$$  \$$   \$$
|  \__| $$
 \$$    $$
  \$$$$$$
                  yaCA - yet another Coding Agent
```

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


yaCA is a local coding agent that runs in your terminal. It talks to models through an OpenAI-compatible `/chat/completions` API and supports file operations, directory listing, text search, command execution, session resume, tool permissions, and a `tool_call_compatible` mode for models that do not support native function calling.

> Disclaimer: this project is developed primarily for learning, research, and teaching practice, and it also serves as part of a course assignment; the current implementation reflects a work-in-progress and does not represent any product commitment, commercial service, or technical support guarantee. Any risk arising from the use of this project, including any direct or indirect loss, liability, or harm to third-party rights and interests, shall be borne by the user.

## Quick Start

```bash
pnpm i -g @woisol-g/yaca
# Or if you don't have pnpm installed, install Node.js and then use npm:
# npm i -g @woisol-g/yaca
yaca
```

First time you start, you can configure the model and API endpoint with `/baseurl`, `/model`, and `/apikey` commands, or directly edit `~/.yaca/config.json`.

Homepage screenshot:
![overview](project/docs/img/README/overview.png)

## Run

Node.js >= 22 is required. pnpm is recommended.

```bash
pnpm install
pnpm run build
pnpm start
```

For development:

```bash
pnpm tsx apps/index.ts
```

Run a single prompt:

```bash
yaca --once "read package.json and summarize this project"
```

Set model and API endpoint:

```bash
yaca --model qwen2.5-vl-7b --baseurl http://127.0.0.1:11434/v1
```

Environment variables are also supported:

```bash
YACA_MODEL=qwen2.5-vl-7b
YACA_BASE_URL=http://127.0.0.1:11434/v1
YACA_API_KEY=your-api-key
```

The default config file is:

```text
~/.yaca/config.json
```

Use `YACA_HOME` to change the config and session directory.

## tool_call_compatible: Tool Calls Without Native Function Calling

By default, yaCA uses standard OpenAI-compatible tools/function calling. If your model or gateway supports the `tools` field correctly, this is the simplest mode.

Many low-cost or free model endpoints, however, do not reliably support native function calling. yaCA therefore provides:

```json
{
  "tool_call": {
    "tool_call_compatible": true
  }
}
```

When enabled, yaCA stops depending on the OpenAI tools field. Instead, the model is instructed to emit XML/SXML-style tool calls:

```xml
<tool_call name="read_file">{"path":"package.json"}</tool_call>
```

yaCA parses that stream, extracts the tool name and JSON arguments, executes the tool, and sends the result back into the model loop. This lets a plain chat model participate in file reading, search, editing, and command execution workflows.

This mode works well with OpenAI-compatible aggregators, relays, and 2api-style services. You can point yaCA at their base URL and use inexpensive or even free available large models while still keeping tool-call workflows.

yaCA also provides `postpone_tool_calls` and `try_fallback` options to improve tool call success rates:
- `try_fallback` asks the parser to recover from imperfect model output. It is especially useful for smaller models, free models, and relayed endpoints.
- `postpone_tool_calls` postpones the next tool call for some seconds after each call finishes, reducing the risk of frequent requests. A value of 5 or more is generally recommended. If you are using a regular paid model, it is not recommended to set this option.

## Configuration

Full config shape:

```json
{
  "model": "qwen2.5-vl-7b",
  "base_url": "http://127.0.0.1:11434/v1",
  "api_key": "optional",
  "max_turns": 20,
  "max_tool_retry": 5,
  "tool_call": {
    "tool_call_compatible": false,
    "postpone_tool_calls": 2,
    "try_fallback": false,
    "allow": {
      "tools": [
        "read_file",
        "list_directory",
        "stat_path",
        "cwd",
        "get_tool_hint"
      ],
      "commands": []
    }
  }
}
```

Common fields:

- `model`: model name.
- `base_url`: OpenAI-compatible API endpoint. yaCA calls `${base_url}/chat/completions`.
- `api_key`: optional; `YACA_API_KEY` is also supported.
- `max_turns`: max model/tool loop count for one task.
- `max_tool_retry`: max consecutive tool failures.
- `tool_call.tool_call_compatible`: enables XML/SXML tool-call compatibility mode.
- `tool_call.try_fallback`: enables fallback parsing for tool calls.
- `tool_call.allow.tools`: tools allowed without prompting.
- `tool_call.allow.commands`: commands allowed without prompting. Exact matches and suffix `*` prefix matches are supported, such as `pnpm *`.

## Tool Permissions

By default, yaCA only allows a small low-risk set of tools:

```json
["read_file", "list_directory", "stat_path", "cwd", "get_tool_hint"]
```

When the model asks for a tool that is not allowed, the UI shows a Yes/No prompt below the status bar. Choosing Yes allows only that single call; it does not add the tool to the allow list.

Manage the tool allow list:

```text
/tool
```

Trust mode:

```text
Shift + Tab
```

Trust mode allows all tool calls and shows `[TRUST MODE]` in the status bar. Press `Shift + Tab` again to return to the default untrusted mode.

Command execution is handled by `exec_command` and has a separate command allow list:

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

`commands` supports:

- `"node --version"`: exact match.
- `"pnpm *"`: allows commands starting with `pnpm `.
- `"*"`: allows every command.

## Built-In Commands

```text
/help                  Show help
/model <name>          Set the current model
/baseurl <url>         Set the OpenAI-compatible base URL
/apikey <key>          Set the API key
/clear                 Clear context and start a new session
/resume [session-id]   List sessions or resume one by id
/continue              Continue the most recent session
/tool                  Open tool allow-list selector
/exit                  Exit REPL
```

## Keyboard Shortcuts

- `Ctrl+C`: double-press to exit when idle; interrupt the current task when busy.
- `Ctrl+O`: toggle tool output expansion.
- `Shift+Tab`: toggle trust/untrust mode.
- `Esc`: clear input; double-press to open rewind.
- `Up/Down`: browse input history.
- `Tab`: path completion.

## Built-In Tools

- `read_file`: read a file.
- `write_file`: write a file.
- `replace_file`: replace file content or a line/column range.
- `list_directory`: list directory entries.
- `search_files`: search text files.
- `stat_path`: inspect path status.
- `move_file`: move or rename a file or directory.
- `remove_file`: remove a file or directory.
- `exec_command`: execute a shell command in the current working directory.
- `cwd`: return the current working directory.
- `get_tool_hint`: return tool usage hints.

## Sessions

yaCA stores sessions per workspace. Use `/resume` to browse history, `/continue` to continue the latest session, and rewind to restore an earlier user message and regenerate from there.

## Development

```bash
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```
