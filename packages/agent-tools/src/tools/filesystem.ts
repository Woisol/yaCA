import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ToolDefinition } from '@yaca/types';
import type { ToolFactory } from './context.js';
import { exists, listEntries, searchFiles } from '../utils/files.js';
import { formatToolPath, resolveToolPath } from '../utils/paths.js';
import { readOptionalEncoding, readOptionalString, readRequiredString } from '../utils/args.js';
import { readRange, replaceTextRange, sliceTextRange } from '../utils/text-range.js';

export const filesystemTools: ToolFactory = ({ cwd }) => {
  const tools: ToolDefinition[] = [{
    name: 'read_file',
    description: 'Read a UTF-8 file. Relative paths are resolved from cwd; absolute paths are allowed.',
    parameters: { path: 'relative or absolute file path' },
    async execute(args) {
      const filePath = resolveToolPath(cwd, readRequiredString(args.path, 'path'));
      const content = await readFile(filePath, readOptionalEncoding(args.encoding) ?? 'utf8');
      return { ok: true, content: sliceTextRange(content.toString(), readRange(args)) };
    }
  }, {
    name: 'write_file',
    description: 'Create or overwrite a UTF-8 file. Relative paths are resolved from cwd; absolute paths are allowed.',
    parameters: { path: 'relative or absolute file path', content: 'text content', dangerouslyOverride: 'true to overwrite existing files' },
    async execute(args) {
      const filePath = resolveToolPath(cwd, readRequiredString(args.path, 'path'));
      const content = readRequiredString(args.content, 'content');
      const append = args.append === true;
      const overwrite = args.dangerouslyOverride === true || append;
      if (!overwrite && await exists(filePath)) {
        return { ok: false, content: `Refusing to overwrite existing file: ${formatToolPath(cwd, filePath)}` };
      }
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, { encoding: readOptionalEncoding(args.encoding) ?? 'utf8', flag: append ? 'a' : 'w' });
      return { ok: true, content: `${append ? 'Appended' : 'Wrote'} ${formatToolPath(cwd, filePath)}` };
    }
  }, {
    name: 'replace_file',
    description: 'Replace exact old_text with new_text inside a file, or replace a line/column range.',
    parameters: { path: 'relative or absolute file path', old_text: 'text to replace', new_text: 'replacement text' },
    async execute(args) {
      const filePath = resolveToolPath(cwd, readRequiredString(args.path, 'path'));
      const oldText = readOptionalString(args.old_text);
      const newText = readRequiredString(args.new_text, 'new_text');
      const content = await readFile(filePath, 'utf8');
      const range = readRange(args);
      if (range) {
        await writeFile(filePath, replaceTextRange(content, range, newText), 'utf8');
        return { ok: true, content: `Updated ${formatToolPath(cwd, filePath)}` };
      }
      if (!oldText) {
        return { ok: false, content: 'old_text or line range is required' };
      }
      if (!content.includes(oldText)) {
        return { ok: false, content: 'old_text not found' };
      }
      await writeFile(filePath, content.replace(oldText, newText), 'utf8');
      return { ok: true, content: `Updated ${formatToolPath(cwd, filePath)}` };
    }
  }, {
    name: 'list_directory',
    description: 'List files in a directory. Relative paths are resolved from cwd; absolute paths are allowed.',
    parameters: { path: 'relative or absolute directory path', recursive: 'true for recursive listing' },
    async execute(args) {
      const directory = resolveToolPath(cwd, readOptionalString(args.path) ?? '.');
      const entries = await listEntries(cwd, directory, args.recursive === true);
      return { ok: true, content: entries.join('\n') };
    }
  }, {
    name: 'search_files',
    description: 'Search text files in a directory. Relative paths are resolved from cwd; absolute paths are allowed.',
    parameters: { pattern: 'text pattern', path: 'optional relative or absolute directory', include: 'optional file extension such as .ts' },
    async execute(args) {
      const pattern = readRequiredString(args.pattern, 'pattern');
      const directory = resolveToolPath(cwd, readOptionalString(args.path) ?? '.');
      const include = readOptionalString(args.include);
      const matches = await searchFiles(cwd, directory, pattern, include);
      return { ok: true, content: matches.join('\n') };
    }
  }];
  return tools;
};
