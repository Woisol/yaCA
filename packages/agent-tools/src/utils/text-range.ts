import { readOptionalNumber } from './args.js';

export type TextRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export function readRange(args: Record<string, unknown>): TextRange | undefined {
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

export function sliceTextRange(content: string, range: TextRange | undefined): string {
  if (!range) {
    return content;
  }
  const { start, end } = rangeToOffsets(content, range);
  return content.slice(start, end);
}

export function replaceTextRange(content: string, range: TextRange, replacement: string): string {
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
