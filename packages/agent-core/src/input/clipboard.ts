import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export type ClipboardImage = {
  extension: '.png' | '.jpg' | '.jpeg' | '.webp';
  data: Buffer;
};

export async function saveClipboardImageReference(image: ClipboardImage, options: { yacaHome?: string } = {}): Promise<string> {
  const home = options.yacaHome ?? process.env.YACA_HOME ?? path.join(homedir(), '.yaca');
  const directory = path.join(home, 'cache', 'clipboard');
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `clipboard-${Date.now()}${image.extension}`);
  await writeFile(filePath, image.data);
  return `@${filePath}`;
}
