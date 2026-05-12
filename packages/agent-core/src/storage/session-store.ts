import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ChatMessage } from '@yaca/types';
import { YACA_HOME } from '../constants/path.js';

const writeQueues = new Map<string, Promise<unknown>>();

export type SessionMeta = {
  id: string;
  name: string;
  project_path: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  total_tokens: number;
};

type ProjectMeta = {
  sessions: SessionMeta[];
};

export class SessionStore {
  private readonly root: string;
  private readonly workspace: string;
  private readonly projectHash: string;

  constructor(options: { homeDirectory?: string; workspace?: string } = {}) {
    const homeDirectory = options.homeDirectory ?? YACA_HOME;
    this.root = path.resolve(homeDirectory);
    this.workspace = path.resolve(options.workspace ?? process.cwd());
    this.projectHash = createHash('sha256').update(this.workspace).digest('hex').slice(0, 16);
  }

  async createSession(name = 'New session'): Promise<SessionMeta> {
    const now = new Date().toISOString();
    const session: SessionMeta = {
      id: randomUUID(),
      name,
      project_path: this.workspace,
      created_at: now,
      updated_at: now,
      message_count: 0,
      total_tokens: 0
    };
    await mkdir(this.sessionDirectory(session.id), { recursive: true });
    await this.writeSession(session);
    const meta = await this.readProjectMeta();
    meta.sessions.unshift(session);
    await this.writeProjectMeta(meta);
    return session;
  }

  async listSessions(): Promise<SessionMeta[]> {
    return (await this.readProjectMeta()).sessions;
  }

  async getSession(id: string): Promise<SessionMeta | undefined> {
    const sessions = await this.listSessions();
    return sessions.find((session) => session.id === id);
  }

  async resumeSession(id: string): Promise<SessionMeta> {
    return this.requireSession(id);
  }

  async renameSession(id: string, name: string): Promise<SessionMeta> {
    const session = await this.requireSession(id);
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Session name cannot be empty');
    }
    const updated: SessionMeta = {
      ...session,
      name: trimmed.slice(0, 80),
      updated_at: new Date().toISOString()
    };
    await this.updateSession(updated);
    return updated;
  }

  async appendMessage(id: string, message: ChatMessage): Promise<void> {
    const session = await this.requireSession(id);
    await mkdir(this.sessionDirectory(id), { recursive: true });
    const messagesPath = this.messagesPath(id);
    const existing = await readFileIfExists(messagesPath);
    // TODO 不是说 jsonl 便于直接 append 吗？
    await atomicWrite(messagesPath, `${existing}${JSON.stringify(message)}\n`);
    const updated: SessionMeta = {
      ...session,
      updated_at: new Date().toISOString(),
      message_count: session.message_count + 1,
      total_tokens: session.total_tokens + estimateTokens(message)
    };
    await this.updateSession(updated);
  }

  async readMessages(id: string): Promise<ChatMessage[]> {
    const content = await readFileIfExists(this.messagesPath(id));
    return content
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ChatMessage);
  }

  async replaceMessages(id: string, messages: ChatMessage[]): Promise<void> {
    const session = await this.requireSession(id);
    await mkdir(this.sessionDirectory(id), { recursive: true });
    const content = messages.map((message) => JSON.stringify(message)).join('\n');
    await atomicWrite(this.messagesPath(id), content ? `${content}\n` : '');
    await this.updateSession({
      ...session,
      updated_at: new Date().toISOString(),
      message_count: messages.length,
      total_tokens: messages.reduce((total, message) => total + estimateTokens(message), 0)
    });
  }

  private async requireSession(id: string): Promise<SessionMeta> {
    const session = await this.getSession(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }
    return session;
  }

  private async updateSession(session: SessionMeta): Promise<void> {
    await this.writeSession(session);
    const meta = await this.readProjectMeta();
    meta.sessions = [session, ...meta.sessions.filter((item) => item.id !== session.id)];
    await this.writeProjectMeta(meta);
  }

  private async readProjectMeta(): Promise<ProjectMeta> {
    const content = await readFileIfExists(this.projectMetaPath());
    return content ? JSON.parse(content) as ProjectMeta : { sessions: [] };
  }

  private async writeProjectMeta(meta: ProjectMeta): Promise<void> {
    await mkdir(this.projectDirectory(), { recursive: true });
    await atomicWrite(this.projectMetaPath(), JSON.stringify(meta, null, 2));
  }

  private async writeSession(session: SessionMeta): Promise<void> {
    await mkdir(this.sessionDirectory(session.id), { recursive: true });
    await atomicWrite(this.sessionPath(session.id), JSON.stringify(session, null, 2));
  }

  private projectDirectory(): string {
    return path.join(this.root, 'sessions', this.projectHash);
  }

  private projectMetaPath(): string {
    return path.join(this.projectDirectory(), 'meta.json');
  }

  private sessionDirectory(id: string): string {
    return path.join(this.projectDirectory(), id);
  }

  private sessionPath(id: string): string {
    return path.join(this.sessionDirectory(id), 'session.json');
  }

  private messagesPath(id: string): string {
    return path.join(this.sessionDirectory(id), 'messages.jsonl');
  }
}

// 原子写
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const next = previous.then(() => withFileLock(filePath, async () => {
    await writeFile(filePath, content, 'utf8');
  }));
  writeQueues.set(filePath, next.catch(() => undefined));
  await next;
}

async function withFileLock<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const lockPath = `${filePath}.lock`;
  const startedAt = Date.now();
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  while (!handle) {
    try {
      handle = await open(lockPath, 'wx');
    } catch (error) {
      if (!isLockConflict(error)) {
        throw error;
      }
      if (await removeStaleLock(lockPath, 5_000)) {
        continue;
      }
      if (Date.now() - startedAt > 5_000) {
        break;
      }
      await delay(25);
    }
  }

  try {
    return await task();
  } finally {
    if (handle) {
      await handle.close();
      await unlinkWithRetry(lockPath).catch(() => undefined);
    }
  }
}

function isLockConflict(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function unlinkWithRetry(filePath: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await unlink(filePath);
      return;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return;
      }
      await delay(25);
    }
  }
  throw lastError;
}

async function removeStaleLock(lockPath: string, staleAfterMs: number): Promise<boolean> {
  try {
    const lockStat = await stat(lockPath);
    if (Date.now() - lockStat.mtimeMs < staleAfterMs) {
      return false;
    }
    await unlinkWithRetry(lockPath);
    return true;
  } catch {
    return true;
  }
}

async function readFileIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function estimateTokens(message: ChatMessage): number {
  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
  return Math.ceil(content.length / 4);
}
