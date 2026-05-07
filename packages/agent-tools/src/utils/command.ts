import { spawn } from 'node:child_process';
import type { ToolResult } from '@yaca/types';

export function executeCommand(cwd: string, command: string, timeout: number): Promise<ToolResult> {
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
