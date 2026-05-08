import sxml from '@woisol-g/sxml.js';
// import { SxmlParser } from '@woisol-g/sxml.js';
import type { SxmlParser as YacaSxmlParser } from '@woisol-g/sxml.js';
import type { ErrorStrategy, SxmlEvent, SxmlResult, TagHandler } from '@woisol-g/sxml.js';
import type { AssistantEvent, ToolCall } from '@yaca/types/index.js';

// ？？？hyw
const { SxmlParser } = sxml as unknown as { SxmlParser: new (config: ConstructorParameters<typeof import('@woisol-g/sxml.js').SxmlParser>[0]) => import('@woisol-g/sxml.js').SxmlParser };
// type YacaSxmlParser = import('@woisol-g/sxml.js').SxmlParser;

export type YacaSxmlEvent = AssistantEvent;

export type YacaSxmlPatch = {
  update?: YacaSxmlEvent | null;
  append: YacaSxmlEvent[];
};

const toolCallHandler: TagHandler = {
  build(_tagName, attrs, children) {
    const content = collectText(children);
    try {
      const args = JSON.parse(content) as unknown;
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw new Error('tool_call content must be a JSON object');
      }
      return {
        type: 'tool_call',
        toolName: attrs.name ?? '',
        args,
        content
      };
    } catch (error) {
      return {
        type: 'parse_error',
        message: `Failed to parse assistant tool call: ${formatParseError(error)}`,
        content
      };
    }
  }
};

export function createYacaSxmlParser(): YacaSxmlParser {
  return new SxmlParser({
    legalTags: [
      { name: 'think', confirmAt: 'open' },
      { name: 'tool_call', confirmAt: 'close' }
    ],
    tagHandlers: {
      tool_call: toolCallHandler
    },
    maxNestingDepth: 1,
    errorStrategy: 'lenient' as ErrorStrategy
  });
}

export function writeAndDrain(parser: YacaSxmlParser, chunk: string): YacaSxmlPatch[] {
  parser.write(chunk);
  return drain(parser);
}

export function endAndDrain(parser: YacaSxmlParser): YacaSxmlPatch[] {
  parser.end();
  return drain(parser);
}

// apply
export function applySxmlPatch(events: YacaSxmlEvent[], patch: YacaSxmlPatch): void {
  if (patch.update === null) {
    events.pop();
  } else if (patch.update !== undefined) {
    events[events.length - 1] = patch.update;
  }
  events.push(...patch.append);
}

export function collectToolCalls(events: YacaSxmlEvent[]): ToolCall[] {
  return events
    .filter((event): event is Extract<YacaSxmlEvent, { type: 'tool_call' }> => event.type === 'tool_call')
    .map((event) => ({ name: event.toolName, args: event.args }));
}

export function collectAssistantText(events: YacaSxmlEvent[]): string {
  return events
    .filter((event) => event.type === 'text' || event.type === 'think')
    .map((event) => event.content)
    .join('');
}

function drain(parser: YacaSxmlParser): YacaSxmlPatch[] {
  const patches: YacaSxmlPatch[] = [];
  let result: SxmlResult | null;
  while ((result = parser.tryPull()) !== null) {
    patches.push({
      update: result.update === undefined ? undefined : normalizeEvent(result.update),
      append: result.append.map((event) => normalizeEvent(event)).filter((event) => event !== null)
    });
  }
  return patches;
}

function normalizeEvent(event: SxmlEvent | null): YacaSxmlEvent | null {
  if (event === null) {
    return null;
  }
  if (event.type === 'text') {
    return { type: 'text', content: readString(event.content) };
  }
  if (event.type === 'think') {
    return { type: 'think', content: readString(event.content) };
  }
  if (event.type === 'tool_call') {
    return {
      type: 'tool_call',
      toolName: readString(event.toolName),
      args: readRecord(event.args),
      content: readString(event.content)
    };
  }
  if (event.type === 'parse_error') {
    return {
      type: 'parse_error',
      message: readString(event.message),
      content: readString(event.content)
    };
  }
  return { type: 'text', content: readString(event.content) };
}

function collectText(children: SxmlEvent[]): string {
  return children
    .filter((child) => child.type === 'text')
    .map((child) => child.content)
    .join('');
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatParseError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error.message.startsWith('Unexpected token')) return 'Unexpected token';
  const [summary] = error.message.split(':');
  return summary || error.message;
}
