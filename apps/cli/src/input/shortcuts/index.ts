import type { Dispatch, SetStateAction } from 'react';
import type { KeyboardShortcut } from '../registry.js';

type MessageKind = 'user' | 'assistant' | 'tool' | 'status' | 'error';

export type ReplShortcutContext = {
  input: string;
  busy: boolean;
  userMessages: string[];
  userMessageHistoryIndex: number | null;
  userMessageDraft: string;
  lastCtrlCAt: number;
  lastEscapeAt: number;
  now(): number;
  setInput: Dispatch<SetStateAction<string>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setUserMessageHistoryIndex: Dispatch<SetStateAction<number | null>>;
  setUserMessageDraft: Dispatch<SetStateAction<string>>;
  setLastCtrlCAt: Dispatch<SetStateAction<number>>;
  setLastEscapeAt: Dispatch<SetStateAction<number>>;
  shortcutsEnabled?: boolean;
  appendLine(kind: MessageKind, text: string): void;
  toggleToolOutput(): void;
  openRewind(): void;
  openResume(): void;
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
        context.setUserMessageHistoryIndex(null);
        context.setUserMessageDraft('');
        if (submitted.length > 0) {
          context.submit(submitted);
        }
      }
    },
    {
      name: 'previous-user-message',
      match: (_input, key) => key.upArrow,
      run: (context) => {
        if (context.userMessages.length === 0) return;
        const nextIndex = context.userMessageHistoryIndex === null
          ? context.userMessages.length - 1
          : Math.max(0, context.userMessageHistoryIndex - 1);
        if (context.userMessageHistoryIndex === null) {
          context.setUserMessageDraft(context.input);
        }
        context.setUserMessageHistoryIndex(nextIndex);
        context.setInput(context.userMessages[nextIndex] ?? '');
      }
    },
    {
      name: 'next-user-message',
      match: (_input, key) => key.downArrow,
      run: (context) => {
        if (context.userMessageHistoryIndex === null) return;
        const nextIndex = context.userMessageHistoryIndex + 1;
        if (nextIndex >= context.userMessages.length) {
          context.setUserMessageHistoryIndex(null);
          context.setInput(context.userMessageDraft);
          context.setUserMessageDraft('');
          return;
        }
        context.setUserMessageHistoryIndex(nextIndex);
        context.setInput(context.userMessages[nextIndex] ?? '');
      }
    },
    {
      name: 'clear-input',
      match: (_input, key) => key.escape,
      run: (context) => {
        const currentTime = context.now();
        if (currentTime - context.lastEscapeAt < 800) {
          context.openRewind();
          context.setLastEscapeAt(0);
        } else {
          context.setLastEscapeAt(currentTime);
          context.setInput('');
          context.setUserMessageHistoryIndex(null);
          context.setUserMessageDraft('');
        }
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
        context.setUserMessageHistoryIndex(null);
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
        context.setUserMessageHistoryIndex(null);
      }
    }
  ];
}
