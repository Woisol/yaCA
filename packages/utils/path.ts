import path from "node:path";

export function pathPrefferentiallyRelative(to: string, from?: string): string {
  const relative = path.relative(from ?? process.cwd(), to);
  return relative.startsWith('..') ? to : relative;
}