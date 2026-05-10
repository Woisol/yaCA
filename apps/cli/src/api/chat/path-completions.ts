import { pathPrefferentiallyRelative } from '@yaca/utils/path.js';
import { readdir } from 'node:fs/promises';
import path from 'node:path';


export type PathCompletionItem = {
  value: string;
  display: string;
  isDirectory: boolean;
};

export type PathCompletionState = {
  token: string;
  replacementRange: { start: number; end: number };
  items: PathCompletionItem[];
};

export async function getPathCompletionState(input: string, cwd: string, limit = 8): Promise<PathCompletionState | null> {
  const token = findActivePathToken(input);
  if (!token) return null;

  const rawPrefix = token.text;
  const parsed = parsePathPrefix(rawPrefix, cwd);
  const entries = await readCompletionEntries(parsed.directoryPath);
  const normalizedMatch = parsed.basenamePrefix.toLowerCase();
  const items = entries
    .filter((entry) => entry.name.toLowerCase().startsWith(normalizedMatch))
    .sort(compareCompletionItems)
    .slice(0, limit)
    .map((entry): PathCompletionItem => {
      const value = toCompletionValue(path.join(parsed.directoryPrefix, entry.name), entry.isDirectory);
      return {
        value,
        display: toDisplayPath(value, cwd),
        isDirectory: entry.isDirectory
      };
    });

  if (items.length === 0) return null;
  return {
    token: rawPrefix,
    replacementRange: { start: token.start, end: token.end },
    items
  };
}

export function applyPathCompletion(input: string, state: PathCompletionState, selectedIndex: number): string {
  const item = state.items[selectedIndex] ?? state.items[0];
  if (!item) return input;
  return `${input.slice(0, state.replacementRange.start)}${item.value}${input.slice(state.replacementRange.end)}`;
}

type ActivePathToken = {
  text: string;
  start: number;
  end: number;
};

function findActivePathToken(input: string): ActivePathToken | null {
  const match = /(?:^|\s)@("[^"]*"?|[^\s]*)$/.exec(input);
  if (!match) return null;
  const rawText = match[1] ?? '';
  const tokenStart = match.index + match[0].lastIndexOf('@') + 1;
  // 甚至 quoted 都考虑好了😢
  const quoted = rawText.startsWith('"');
  const text = quoted ? rawText.slice(1, rawText.endsWith('"') ? -1 : undefined) : rawText;
  return { text, start: tokenStart + (quoted ? 1 : 0), end: input.length - (quoted && rawText.endsWith('"') ? 1 : 0) };
}

function parsePathPrefix(prefix: string, cwd: string): { directoryPath: string; directoryPrefix: string; basenamePrefix: string } {
  const normalized = prefix.replace(/[\\/]+/g, path.sep);
  const directoryPrefix = normalized.endsWith(path.sep)
    ? normalized
    : path.dirname(normalized) === '.'
      ? ''
      : `${path.dirname(normalized)}${path.sep}`;
  const basenamePrefix = normalized.endsWith(path.sep) ? '' : path.basename(normalized);
  const directoryPath = path.resolve(cwd, directoryPrefix || '.');
  return { directoryPath, directoryPrefix, basenamePrefix };
}

async function readCompletionEntries(directoryPath: string): Promise<Array<{ name: string; isDirectory: boolean }>> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() || entry.isDirectory())
      .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
  } catch {
    return [];
  }
}

function compareCompletionItems(left: { name: string; isDirectory: boolean }, right: { name: string; isDirectory: boolean }): number {
  if (left.isDirectory !== right.isDirectory) return left.isDirectory ? 1 : -1;
  return left.name.localeCompare(right.name);
}

function toCompletionValue(value: string, isDirectory: boolean): string {
  const normalized = value.replaceAll('\\', '/');
  return isDirectory && !normalized.endsWith('/') ? `${normalized}/` : normalized;
}

function toDisplayPath(value: string, cwd: string): string {
  const suffix = value.endsWith('/') ? '/' : '';
  const absolute = path.resolve(cwd, value);
  const chosen = pathPrefferentiallyRelative(absolute, cwd);
  const relative = String(chosen).replaceAll('\\', '/');
  return `${relative || path.basename(value)}${suffix}`;
}
