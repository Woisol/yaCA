import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchShortcutInput, type KeyboardShortcut, type ShortcutKey } from '../apps/cli/src/input/registry.js';
import { createReplShortcuts, type ReplShortcutContext } from '../apps/cli/src/input/shortcuts/index.js';

function key(overrides: Partial<ShortcutKey>): ShortcutKey {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    super: false,
    hyper: false,
    capsLock: false,
    numLock: false,
    ...overrides
  };
}

test('dispatchShortcutInput runs the first matching shortcut', () => {
  const events: string[] = [];
  const shortcuts: KeyboardShortcut<string[]>[] = [
    {
      name: 'first',
      match: (input) => input === 'x',
      run: (context) => {
        context.push('first');
      }
    },
    {
      name: 'second',
      match: (input) => input === 'x',
      run: (context) => {
        context.push('second');
      }
    }
  ];

  const handled = dispatchShortcutInput(shortcuts, 'x', key({}), events);

  assert.equal(handled, true);
  assert.deepEqual(events, ['first']);
});

test('dispatchShortcutInput skips shortcuts when their guard is false', () => {
  const events: string[] = [];
  const shortcuts: KeyboardShortcut<string[]>[] = [
    {
      name: 'guarded',
      when: () => false,
      match: () => true,
      run: (context) => {
        context.push('guarded');
      }
    },
    {
      name: 'fallback',
      match: () => true,
      run: (context) => {
        context.push('fallback');
      }
    }
  ];

  const handled = dispatchShortcutInput(shortcuts, '', key({}), events);

  assert.equal(handled, true);
  assert.deepEqual(events, ['fallback']);
});

test('createReplShortcuts submits trimmed input on return', () => {
  const submitted: string[] = [];
  const context = createContext({
    input: '  hello  ',
    submit: (text) => {
      submitted.push(text);
    }
  });

  const handled = dispatchShortcutInput(createReplShortcuts(), '', key({ return: true }), context);

  assert.equal(handled, true);
  assert.equal(context.input, '');
  assert.deepEqual(submitted, ['hello']);
});

test('createReplShortcuts ignores non-interrupt input while busy', () => {
  const context = createContext({ input: 'draft', busy: true });

  const handled = dispatchShortcutInput(createReplShortcuts(), 'x', key({}), context);

  assert.equal(handled, true);
  assert.equal(context.input, 'draft');
});

test('createReplShortcuts handles ctrl+c as interrupt before exit while busy', () => {
  const context = createContext({ busy: true });

  dispatchShortcutInput(createReplShortcuts(), 'c', key({ ctrl: true }), context);

  assert.equal(context.busy, false);
  assert.equal(context.exited, false);
  assert.deepEqual(context.messages, ['Interrupted current operation. The in-flight model request may still finish server-side.']);
});

test('createReplShortcuts requires two ctrl+c presses to exit when idle', () => {
  const context = createContext({ now: () => 1000 });
  const shortcuts = createReplShortcuts();

  dispatchShortcutInput(shortcuts, 'c', key({ ctrl: true }), context);
  context.now = () => 1500;
  dispatchShortcutInput(shortcuts, 'c', key({ ctrl: true }), context);

  assert.equal(context.exited, true);
  assert.deepEqual(context.messages, ['Press Ctrl+C again to exit.']);
});

test('createReplShortcuts appends typed input and deletes one character', () => {
  const context = createContext({ input: 'ab' });
  const shortcuts = createReplShortcuts();

  dispatchShortcutInput(shortcuts, 'c', key({}), context);
  dispatchShortcutInput(shortcuts, '', key({ backspace: true }), context);

  assert.equal(context.input, 'ab');
});

type TestReplContext = ReplShortcutContext & {
  exited: boolean;
  messages: string[];
};

function createContext(overrides: Partial<TestReplContext> = {}): TestReplContext {
  const context: TestReplContext = {
    input: overrides.input ?? '',
    busy: overrides.busy ?? false,
    lastCtrlCAt: overrides.lastCtrlCAt ?? 0,
    now: overrides.now ?? (() => 0),
    exited: false,
    messages: [],
    setInput(value) {
      context.input = typeof value === 'function' ? value(context.input) : value;
    },
    setBusy(value) {
      context.busy = typeof value === 'function' ? value(context.busy) : value;
    },
    setLastCtrlCAt(value) {
      context.lastCtrlCAt = typeof value === 'function' ? value(context.lastCtrlCAt) : value;
    },
    appendLine(kind, text) {
      assert.equal(kind, 'status');
      context.messages.push(text);
    },
    exit() {
      context.exited = true;
    },
    submit() {},
    ...overrides
  };
  return context;
}
