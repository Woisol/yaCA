import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import type { MessagePart } from '@yaca/types';
import { YACA_HOME } from '../constants/path.js';

const imageMimeTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
]);

export type ParseUserInputOptions = {
  yacaHome?: string;
};

export async function parseUserInput(input: string, cwd = process.cwd(), options: ParseUserInputOptions = {}): Promise<MessagePart[]> {
  const parts: MessagePart[] = [];
  const matcher = /@(?:("[^"]+")|([^\s]+))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(input)) !== null) {
    const rawReference = match[1] ?? match[2] ?? '';
    const reference = rawReference.startsWith('"') && rawReference.endsWith('"')
      ? rawReference.slice(1, -1)
      : rawReference;
    const resolved = path.resolve(cwd, reference);
    const filePart = await tryCreateFilePart(resolved, options.yacaHome ?? YACA_HOME);

    if (!filePart) {
      continue;
    }

    appendText(parts, input.slice(cursor, match.index));
    parts.push(filePart);
    cursor = match.index + match[0].length;
  }

  appendText(parts, input.slice(cursor));
  return parts.length === 0 ? [{ type: 'text', text: input }] : mergeTextParts(parts);
}

async function tryCreateFilePart(filePath: string, yacaHome: string): Promise<MessagePart | undefined> {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return undefined;
  } catch {
    return undefined;
  }

  return await tryCreateImagePart(filePath, yacaHome)
    ?? { type: 'text', text: await readFile(filePath, 'utf8') };
}

async function tryCreateImagePart(filePath: string, yacaHome: string): Promise<MessagePart | undefined> {
  const mimeType = imageMimeTypes.get(path.extname(filePath).toLowerCase());
  if (!mimeType) {
    return undefined;
  }

  try {
    const data = await readFile(filePath);
    await cacheBase64Image(yacaHome, filePath, data.toString('base64'));
    return {
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${data.toString('base64')}` }
    };
  } catch {
    return undefined;
  }
}

async function cacheBase64Image(yacaHome: string, filePath: string, base64: string): Promise<void> {
  const hash = createHash('sha256').update(filePath).digest('hex').slice(0, 16);
  const cacheDirectory = path.join(yacaHome, 'cache', hash);
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(path.join(cacheDirectory, `${path.basename(filePath)}.base64`), base64, 'utf8');
}

function appendText(parts: MessagePart[], text: string): void {
  if (text.length > 0) {
    parts.push({ type: 'text', text });
  }
}

function mergeTextParts(parts: MessagePart[]): MessagePart[] {
  const merged: MessagePart[] = [];
  for (const part of parts) {
    const previous = merged.at(-1);
    if (part.type === 'text' && previous?.type === 'text') {
      previous.text += part.text;
    } else {
      merged.push(part);
    }
  }
  return merged;
}
