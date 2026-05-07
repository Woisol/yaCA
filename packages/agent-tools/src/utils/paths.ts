import path from 'node:path';

export function resolveToolPath(cwd: string, target: string): string {
  return path.resolve(cwd, target);
}

export function formatToolPath(cwd: string, target: string): string {
  const relative = path.relative(cwd, target);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : target;
}
