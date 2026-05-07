import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { formatToolPath } from './paths.js';

export async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listEntries(cwd: string, directory: string, recursive: boolean): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    output.push(entry.isDirectory() ? `${formatToolPath(cwd, fullPath)}/` : formatToolPath(cwd, fullPath));
    if (recursive && entry.isDirectory()) {
      output.push(...await listEntries(cwd, fullPath, true));
    }
  }
  return output;
}

export async function searchFiles(cwd: string, directory: string, pattern: string, include?: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: string[] = [];
  const needle = pattern.toLowerCase();
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...await searchFiles(cwd, fullPath, pattern, include));
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
          matches.push(`${formatToolPath(cwd, fullPath)}:${index + 1}: ${line}`);
        }
      }
    } catch {
      continue;
    }
  }
  return matches;
}
