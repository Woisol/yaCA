import { useInput, type Key } from 'ink';

export type ShortcutKey = Key;

export type KeyboardShortcut<TContext> = {
  name: string;
  when?: (context: TContext) => boolean;
  match(input: string, key: ShortcutKey, context: TContext): boolean;
  run(context: TContext, input: string, key: ShortcutKey): void;
};

export function dispatchShortcutInput<TContext>(
  shortcuts: readonly KeyboardShortcut<TContext>[],
  input: string,
  key: ShortcutKey,
  context: TContext
): boolean {
  const shortcut = shortcuts.find((item) => {
    return (item.when?.(context) ?? true) && item.match(input, key, context);
  });
  if (!shortcut) return false;
  shortcut.run(context, input, key);
  return true;
}

// ✅ context 的做法比你传一堆变量函数进来好多了😂
export function useKeyboardShortcuts<TContext>(
  context: TContext,
  shortcuts: readonly KeyboardShortcut<TContext>[]
): void {
  useInput((input, key) => {
    // allow callers to disable global shortcuts (e.g. when a modal like Rewind is open)
    if ((context as unknown as { shortcutsEnabled?: boolean }).shortcutsEnabled === false) return;
    dispatchShortcutInput(shortcuts, input, key, context);
  });
}
