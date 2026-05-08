import type { Dispatch, SetStateAction } from 'react';
import type { KeyboardShortcut } from '../registry.js';

type MessageKind = 'user' | 'assistant' | 'tool' | 'status' | 'error';

export type ReplShortcutContext = {
  input: string;
  busy: boolean;
  lastCtrlCAt: number;
  now(): number;
  setInput: Dispatch<SetStateAction<string>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setLastCtrlCAt: Dispatch<SetStateAction<number>>;
  appendLine(kind: MessageKind, text: string): void;
  toggleToolOutput(): void;
  submit(text: string): void;
  exit(): void;
};

export function createReplShortcuts(): KeyboardShortcut<ReplShortcutContext>[] {
  return [
    {
      name: 'interrupt-busy-operation',
      when: (context) => context.busy,
      match: (input, key) => key.ctrl && input === 'c',
      run: (context) => {
        context.appendLine('status', 'Interrupted current operation. The in-flight model request may still finish server-side.');
        context.setBusy(false);
      }
    },
    {
      name: 'ignore-input-while-busy',
      when: (context) => context.busy,
      match: () => true,
      run: () => {}
    },
    {
      name: 'toggle-tool-output',
      match: (input, key) => key.ctrl && input === 'o',
      run: (context) => {
        context.toggleToolOutput();
      }
    },
    {
      name: 'submit-input',
      match: (_input, key) => key.return,
      run: (context) => {
        const submitted = context.input.trim();
        context.setInput('');
        if (submitted.length > 0) {
          context.submit(submitted);
        }
      }
    },
    {
      name: 'clear-input',
      match: (_input, key) => key.escape,
      run: (context) => {
        context.setInput('');
      }
    },
    {
      name: 'clipboard-image-hint',
      match: (input, key) => key.ctrl && input === 'v',
      run: (context) => {
        context.appendLine('status', 'Clipboard image paste stores images as @path references when terminal clipboard image data is available.');
      }
    },
    {
      name: 'delete-character',
      match: (_input, key) => key.backspace || key.delete,
      run: (context) => {
        context.setInput((current) => current.slice(0, -1));
      }
    },
    {
      name: 'confirm-exit',
      match: (input, key) => key.ctrl && input === 'c',
      run: (context) => {
        const currentTime = context.now();
        if (currentTime - context.lastCtrlCAt < 800) {
          context.exit();
        } else {
          context.setLastCtrlCAt(currentTime);
          context.appendLine('status', 'Press Ctrl+C again to exit.');
        }
      }
    },
    {
      name: 'append-input',
      match: (input) => input.length > 0,
      run: (context, input) => {
        context.setInput((current) => current + input);
      }
    }
  ];
}
