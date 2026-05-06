import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { ToolDefinition, ToolResult } from '@yaca/types';

type SupportedEncoding = BufferEncoding;

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, content: `Unknown tool: ${name}` };
    }
    try {
      return await tool.execute(args);
    } catch (error) {
      return { ok: false, content: error instanceof Error ? error.message : String(error) };
    }
  }

  hint(toolName?: string): string {
    const selected = toolName ? [...this.tools.values()].filter((tool) => tool.name === toolName) : [...this.tools.values()];
    return selected
      .map((tool) => `${tool.name}: ${tool.description}\nparameters: ${JSON.stringify(tool.parameters)}`)
      .join('\n\n');
  }
}

export function createDefaultToolRegistry(workspace: string): ToolRegistry {
  const root = path.resolve(workspace);
  const registry = new ToolRegistry();

  registry.register({
    name: 'get_tool_hint',
    description: 'Get available tool usage hints.',
    parameters: { toolName: 'optional tool name' },
    async execute(args) {
      return { ok: true, content: registry.hint(readOptionalString(args.toolName)) };
    }
  });

  registry.register({
    name: 'read_file',
    description: 'Read a UTF-8 file inside the workspace.',
    parameters: { path: 'file path relative to workspace' },
    async execute(args) {
      const filePath = safeResolve(root, readRequiredString(args.path, 'path'));
      const content = await readFile(filePath, readOptionalEncoding(args.encoding) ?? 'utf8');
      return { ok: true, content: sliceTextRange(content.toString(), readRange(args)) };
    }
  });

  registry.register({
    name: 'write_file',
    description: 'Create or overwrite a UTF-8 file inside the workspace.',
    parameters: { path: 'file path', content: 'text content', dangerouslyOverride: 'true to overwrite existing files' },
    async execute(args) {
      const filePath = safeResolve(root, readRequiredString(args.path, 'path'));
      const content = readRequiredString(args.content, 'content');
      const append = args.append === true;
      const overwrite = args.dangerouslyOverride === true || append;
      if (!overwrite && await exists(filePath)) {
        return { ok: false, content: `Refusing to overwrite existing file: ${path.relative(root, filePath)}` };
      }
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, { encoding: readOptionalEncoding(args.encoding) ?? 'utf8', flag: append ? 'a' : 'w' });
      return { ok: true, content: `${append ? 'Appended' : 'Wrote'} ${path.relative(root, filePath)}` };
    }
  });

  registry.register({
    name: 'replace_file',
    description: 'Replace exact old_text with new_text inside a file.',
    parameters: { path: 'file path', old_text: 'text to replace', new_text: 'replacement text' },
    async execute(args) {
      const filePath = safeResolve(root, readRequiredString(args.path, 'path'));
      const oldText = readOptionalString(args.old_text);
      const newText = readRequiredString(args.new_text, 'new_text');
      const content = await readFile(filePath, 'utf8');
      const range = readRange(args);
      if (range) {
        await writeFile(filePath, replaceTextRange(content, range, newText), 'utf8');
        return { ok: true, content: `Updated ${path.relative(root, filePath)}` };
      }
      if (!oldText) {
        return { ok: false, content: 'old_text or line range is required' };
      }
      if (!content.includes(oldText)) {
        return { ok: false, content: 'old_text not found' };
      }
      await writeFile(filePath, content.replace(oldText, newText), 'utf8');
      return { ok: true, content: `Updated ${path.relative(root, filePath)}` };
    }
  });

  registry.register({
    name: 'list_directory',
    description: 'List files in a workspace directory.',
    parameters: { path: 'directory path', recursive: 'true for recursive listing' },
    async execute(args) {
      const directory = safeResolve(root, readOptionalString(args.path) ?? '.');
      const entries = await listEntries(root, directory, args.recursive === true);
      return { ok: true, content: entries.join('\n') };
    }
  });

  registry.register({
    name: 'search_files',
    description: 'Search text files inside the workspace.',
    parameters: { pattern: 'text or regex pattern', path: 'optional directory', include: 'optional file extension such as .ts' },
    async execute(args) {
      const pattern = readRequiredString(args.pattern, 'pattern');
      const directory = safeResolve(root, readOptionalString(args.path) ?? '.');
      const include = readOptionalString(args.include);
      const matches = await searchFiles(root, directory, pattern, include);
      return { ok: true, content: matches.join('\n') };
    }
  });

  registry.register({
    name: 'exec_command',
    description: 'Execute a command in the workspace.',
    parameters: { command: 'command and arguments', timeout: 'timeout in milliseconds', approve: 'must be true to execute' },
    async execute(args) {
      if (args.approve !== true) {
        return { ok: false, content: 'exec_command requires approve: true' };
      }
      return executeCommand(root, readRequiredString(args.command, 'command'), readOptionalNumber(args.timeout) ?? 30_000);
    }
  });

  return registry;
}

function safeResolve(root: string, target: string): string {
  const resolved = path.resolve(root, target);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path is outside workspace: ${target}`);
  }
  return resolved;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listEntries(root: string, directory: string, recursive: boolean): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(root, fullPath);
    output.push(entry.isDirectory() ? `${relative}/` : relative);
    if (recursive && entry.isDirectory()) {
      output.push(...await listEntries(root, fullPath, true));
    }
  }
  return output;
}

async function searchFiles(root: string, directory: string, pattern: string, include?: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: string[] = [];
  const needle = pattern.toLowerCase();
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...await searchFiles(root, fullPath, pattern, include));
      continue;
    }
    if (include && !entry.name.endsWith(include)) {
      continue;
    }
    try {
      const content = await readFile(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const [index, line] of lines.entries()) {
        if (line.toLowerCase().includes(needle)) {
          matches.push(`${path.relative(root, fullPath)}:${index + 1}: ${line}`);
        }
      }
    } catch {
      continue;
    }
  }
  return matches;
}

function executeCommand(cwd: string, command: string, timeout: number): Promise<ToolResult> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, content: `Command timed out after ${timeout}ms` });
    }, timeout);

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, content: [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join('\n') });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, content: error.message });
    });
  });
}

function readRequiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readOptionalEncoding(value: unknown): SupportedEncoding | undefined {
  return typeof value === 'string' && Buffer.isEncoding(value) ? value as SupportedEncoding : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

type TextRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

function readRange(args: Record<string, unknown>): TextRange | undefined {
  const startLineNumber = readOptionalNumber(args.startLineNumber);
  const endLineNumber = readOptionalNumber(args.endLineNumber);
  if (!startLineNumber && !endLineNumber) {
    return undefined;
  }
  return {
    startLineNumber: startLineNumber ?? 1,
    startColumn: readOptionalNumber(args.startColumn) ?? 1,
    endLineNumber: endLineNumber ?? startLineNumber ?? 1,
    endColumn: readOptionalNumber(args.endColumn) ?? Number.MAX_SAFE_INTEGER
  };
}

function sliceTextRange(content: string, range: TextRange | undefined): string {
  if (!range) {
    return content;
  }
  const { start, end } = rangeToOffsets(content, range);
  return content.slice(start, end);
}

function replaceTextRange(content: string, range: TextRange, replacement: string): string {
  const { start, end } = rangeToOffsets(content, range);
  return `${content.slice(0, start)}${replacement}${content.slice(end)}`;
}

function rangeToOffsets(content: string, range: TextRange): { start: number; end: number } {
  const lineStarts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') {
      lineStarts.push(index + 1);
    }
  }
  const start = lineColumnToOffset(content, lineStarts, range.startLineNumber, range.startColumn);
  const end = lineColumnToOffset(content, lineStarts, range.endLineNumber, range.endColumn);
  return { start, end };
}

function lineColumnToOffset(content: string, lineStarts: number[], lineNumber: number, column: number): number {
  const lineStart = lineStarts[Math.max(0, lineNumber - 1)] ?? content.length;
  const nextLineStart = lineStarts[lineNumber] ?? content.length + 1;
  const lineEnd = Math.max(lineStart, nextLineStart - 1);
  return Math.min(lineStart + Math.max(0, column - 1), lineEnd);
}
