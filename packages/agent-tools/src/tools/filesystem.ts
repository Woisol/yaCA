import { mkdir, readFile, writeFile, stat, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { ToolDefinition } from '@yaca/types';
import type { ToolFactory } from './context.js';
import { exists, listEntries, searchFiles } from '../utils/files.js';
import { formatToolPath, resolveToolPath } from '../utils/paths.js';
import { readOptionalBoolean, readOptionalEncoding, readOptionalString, readRequiredString } from '../utils/args.js';
import { readRange, replaceTextRange, sliceTextRange } from '../utils/text-range.js';

export const filesystemTools: ToolFactory = ({ cwd }) => {
  const tools: ToolDefinition[] = [{
    name: 'read_file',
    description: 'Read a UTF-8 file. Relative paths are resolved from cwd; absolute paths are allowed.',
    parameters: {
      path: 'relative or absolute file path',
      startLineNumber: 'optional start line number (1-based)',
      startColumn: 'optional start column (1-based, default 0)',
      endLineNumber: 'optional end line number',
      endColumn: 'optional end column (1-based, default 0)'
    },
    async execute(args) {
      const filePath = resolveToolPath(cwd, readRequiredString(args.path, 'path'));
      const content = await readFile(filePath, readOptionalEncoding(args.encoding) ?? 'utf8');
      return { ok: true, content: sliceTextRange(content.toString(), readRange(args)) };
    }
  }, {
    name: 'write_file',
    description: 'Create or overwrite a UTF-8 file. Relative paths are resolved from cwd; absolute paths are allowed.',
    parameters: {
      path: 'relative or absolute file path',
      content: 'text content',
      append: 'true to append instead of overwrite',
      encoding: 'optional encoding (default: utf8)',
      dangerouslyOverride: 'true to overwrite existing files'
    },
    async execute(args) {
      const filePath = resolveToolPath(cwd, readRequiredString(args.path, 'path'));
      const content = readRequiredString(args.content, 'content');
      const append = readOptionalBoolean(args.append) === true;
      const overwrite = readOptionalBoolean(args.dangerouslyOverride) === true || append;
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
    parameters: {
      path: 'relative or absolute file path',
      old_text: 'text to replace (optional if using line range)',
      new_text: 'replacement text',
      startLineNumber: 'optional start line number for range replacement',
      startColumn: 'optional start column for range replacement',
      endLineNumber: 'optional end line number',
      endColumn: 'optional end column'
    },
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
      const entries = await listEntries(cwd, directory, readOptionalBoolean(args.recursive) === true);
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
  }, {
    name: 'stat_path',
    description: 'Check the status of a path, returning size, timestamps, and whether it is a file or directory.',
    parameters: { path: 'relative or absolute path' },
    async execute(args) {
      const targetPath = resolveToolPath(cwd, readRequiredString(args.path, 'path'));
      try {
        const stats = await stat(targetPath);
        return {
          ok: true,
          content: JSON.stringify({
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          }, null, 2)
        };
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return { ok: false, content: `Path does not exist: ${formatToolPath(cwd, targetPath)}` };
        }
        throw err;
      }
    }
  }, {
    name: 'move_file',
    description: 'Move or rename a file or directory.',
    parameters: {
      source: 'relative or absolute source path',
      destination: 'relative or absolute destination path',
      dangerouslyOverride: 'true to overwrite existing destination'
    },
    async execute(args) {
      const source = resolveToolPath(cwd, readRequiredString(args.source, 'source'));
      const destination = resolveToolPath(cwd, readRequiredString(args.destination, 'destination'));
      const override = readOptionalBoolean(args.dangerouslyOverride) === true;

      if (!await exists(source)) {
        return { ok: false, content: `Source not found: ${formatToolPath(cwd, source)}` };
      }
      if (!override && await exists(destination)) {
        return { ok: false, content: `Destination already exists: ${formatToolPath(cwd, destination)}` };
      }

      await mkdir(path.dirname(destination), { recursive: true });
      await rename(source, destination);
      return { ok: true, content: `Moved ${formatToolPath(cwd, source)} to ${formatToolPath(cwd, destination)}` };
    }
  }, {
    name: 'remove_file',
    description: 'Remove a file or directory.',
    parameters: {
      path: 'relative or absolute path to remove',
      recursive: 'true to recursively remove directories',
      dangerouslyRemoveOutsideOfWorkspace: 'true to allow removal outside of the current working directory'
    },
    async execute(args) {
      const rawPath = readRequiredString(args.path, 'path');
      const targetPath = resolveToolPath(cwd, rawPath);
      const allowOutside = readOptionalBoolean(args.dangerouslyRemoveOutsideOfWorkspace) === true;

      const relativeToCwd = path.relative(cwd, targetPath);
      const isOutside = relativeToCwd.startsWith('..') || path.isAbsolute(relativeToCwd);

      if (isOutside && !allowOutside) {
        return { ok: false, content: `Refusing to remove path outside of workspace: ${formatToolPath(cwd, targetPath)}` };
      }

      if (!await exists(targetPath)) {
        return { ok: false, content: `Path not found: ${formatToolPath(cwd, targetPath)}` };
      }

      await rm(targetPath, { recursive: readOptionalBoolean(args.recursive) === true, force: true });
      return { ok: true, content: `Removed ${formatToolPath(cwd, targetPath)}` };
    }
  }];
  return tools;
};
