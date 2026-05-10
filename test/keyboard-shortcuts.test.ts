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

test('createReplShortcuts leaves return for the text input component', () => {
  const submitted: string[] = [];
  const context = createContext({
    input: '  hello  ',
    submit: (text) => {
      submitted.push(text);
    }
  });

  const handled = dispatchShortcutInput(createReplShortcuts(), '', key({ return: true }), context);

  assert.equal(handled, false);
  assert.equal(context.input, '  hello  ');
  assert.deepEqual(submitted, []);
});

test('createReplShortcuts ignores non-interrupt input while busy', () => {
  const context = createContext({ input: 'draft', busy: true });

  const handled = dispatchShortcutInput(createReplShortcuts(), 'x', key({}), context);

  assert.equal(handled, true);
  assert.equal(context.input, 'draft');
});

test('createReplShortcuts handles ctrl+c as interrupt before exit while busy', () => {
  let aborted = false;
  const context = createContext({
    busy: true,
    abortCurrentTurn() {
      aborted = true;
    }
  });

  dispatchShortcutInput(createReplShortcuts(), 'c', key({ ctrl: true }), context);

  assert.equal(context.busy, false);
  assert.equal(aborted, true);
  assert.equal(context.exited, false);
  assert.deepEqual(context.messages, ['Interrupted current operation.']);
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

test('createReplShortcuts leaves editing keys for the text input component', () => {
  const context = createContext({ input: 'ab' });
  const shortcuts = createReplShortcuts();

  assert.equal(dispatchShortcutInput(shortcuts, 'c', key({}), context), false);
  assert.equal(dispatchShortcutInput(shortcuts, '', key({ backspace: true }), context), false);
  assert.equal(dispatchShortcutInput(shortcuts, '', key({ delete: true }), context), false);
  assert.equal(context.input, 'ab');
});

test('createReplShortcuts toggles tool output on ctrl+o', () => {
  let toggled = false;
  let preserved = false;
  const context = createContext({
    preserveInputAfterShortcut() {
      preserved = true;
    },
    toggleToolOutput() {
      toggled = true;
    }
  });

  const handled = dispatchShortcutInput(createReplShortcuts(), 'o', key({ ctrl: true }), context);

  assert.equal(handled, true);
  assert.equal(toggled, true);
  assert.equal(preserved, true);
});

test('createReplShortcuts toggles trust mode on shift+tab', () => {
  let toggled = false;
  let preserved = false;
  const context = createContext({
    preserveInputAfterShortcut() {
      preserved = true;
    },
    toggleTrustMode() {
      toggled = true;
    }
  });

  const handled = dispatchShortcutInput(createReplShortcuts(), '', key({ tab: true, shift: true }), context);

  assert.equal(handled, true);
  assert.equal(toggled, true);
  assert.equal(preserved, true);
});

test('createReplShortcuts preserves input on ctrl+v hint', () => {
  let preserved = false;
  const context = createContext({
    preserveInputAfterShortcut() {
      preserved = true;
    }
  });

  const handled = dispatchShortcutInput(createReplShortcuts(), 'v', key({ ctrl: true }), context);

  assert.equal(handled, true);
  assert.equal(preserved, true);
  assert.deepEqual(context.messages, ['Clipboard image paste stores images as @path references when terminal clipboard image data is available.']);
});

test('createReplShortcuts opens rewind on double escape', () => {
  let rewindOpened = false;
  const context = createContext({
    now: () => 1000,
    openRewind() {
      rewindOpened = true;
    }
  });
  const shortcuts = createReplShortcuts();

  dispatchShortcutInput(shortcuts, '', key({ escape: true }), context);
  context.now = () => 1300;
  const handled = dispatchShortcutInput(shortcuts, '', key({ escape: true }), context);

  assert.equal(handled, true);
  assert.equal(rewindOpened, true);
});

test('createReplShortcuts navigates user message history with up and down arrows', () => {
  const context = createContext({
    input: 'draft',
    userMessages: ['first', 'second']
  });
  const shortcuts = createReplShortcuts();

  dispatchShortcutInput(shortcuts, '', key({ upArrow: true }), context);
  assert.equal(context.input, 'second');

  dispatchShortcutInput(shortcuts, '', key({ upArrow: true }), context);
  assert.equal(context.input, 'first');

  dispatchShortcutInput(shortcuts, '', key({ downArrow: true }), context);
  assert.equal(context.input, 'second');

  dispatchShortcutInput(shortcuts, '', key({ downArrow: true }), context);
  assert.equal(context.input, 'draft');
});

type TestReplContext = ReplShortcutContext & {
  exited: boolean;
  messages: string[];
};

function createContext(overrides: Partial<TestReplContext> = {}): TestReplContext {
  const context: TestReplContext = {
    input: overrides.input ?? '',
    busy: overrides.busy ?? false,
    userMessages: overrides.userMessages ?? [],
    userMessageHistoryIndex: overrides.userMessageHistoryIndex ?? null,
    userMessageDraft: overrides.userMessageDraft ?? '',
    lastCtrlCAt: overrides.lastCtrlCAt ?? 0,
    lastEscapeAt: overrides.lastEscapeAt ?? 0,
    now: overrides.now ?? (() => 0),
    exited: false,
    messages: [],
    setInput(value) {
      context.input = typeof value === 'function' ? value(context.input) : value;
    },
    setBusy(value) {
      context.busy = typeof value === 'function' ? value(context.busy) : value;
    },
    setUserMessageHistoryIndex(value) {
      context.userMessageHistoryIndex = typeof value === 'function' ? value(context.userMessageHistoryIndex) : value;
    },
    setUserMessageDraft(value) {
      context.userMessageDraft = typeof value === 'function' ? value(context.userMessageDraft) : value;
    },
    setLastCtrlCAt(value) {
      context.lastCtrlCAt = typeof value === 'function' ? value(context.lastCtrlCAt) : value;
    },
    setLastEscapeAt(value) {
      context.lastEscapeAt = typeof value === 'function' ? value(context.lastEscapeAt) : value;
    },
    appendLine(kind, text) {
      assert.equal(kind, 'status');
      context.messages.push(text);
    },
    exit() {
      context.exited = true;
    },
    toggleToolOutput() {},
    toggleTrustMode() {},
    openRewind() {},
    openResume() {},
    openToolSelect() {},
    submit() {},
    ...overrides
  };
  return context;
}
