import React, { useEffect, useState } from 'react';
import { Text, useInput, type Key } from 'ink';

export type TextInputState = {
  value: string;
  cursorOffset: number;
  cursorWidth?: number;
};

export type TextInputResult = {
  value: string;
  cursorOffset: number;
  cursorWidth: number;
  submitted?: string;
};

export type EnhancedTextInputProps = {
  placeholder?: string;
  focus?: boolean;
  mask?: string;
  highlightPastedText?: boolean;
  showCursor?: boolean;
  value: string;
  cursorOffset?: number;
  onChange(value: string, cursorOffset: number): void;
  onSubmit?(value: string): void;
};

export function EnhancedTextInput({
  value: originalValue,
  placeholder = '',
  focus = true,
  mask,
  highlightPastedText = false,
  showCursor = true,
  cursorOffset: controlledCursorOffset,
  onChange,
  onSubmit,
}: EnhancedTextInputProps) {
  const [state, setState] = useState({
    cursorOffset: controlledCursorOffset ?? (originalValue || '').length,
    cursorWidth: 0,
  });
  const cursorOffset = controlledCursorOffset ?? state.cursorOffset;
  const cursorWidth = state.cursorWidth;

  useEffect(() => {
    setState((previousState) => {
      if (!focus || !showCursor || controlledCursorOffset !== undefined) {
        return previousState;
      }
      const clamped = clampCursorOffset(previousState.cursorOffset, originalValue || '');
      if (clamped === previousState.cursorOffset) return previousState;
      return { cursorOffset: clamped, cursorWidth: 0 };
    });
  }, [originalValue, focus, showCursor, controlledCursorOffset]);

  useInput((input, key) => {
    const result = applyTextInputKey({ value: originalValue, cursorOffset }, input, key);
    if (result.submitted !== undefined) {
      onSubmit?.(result.submitted);
      return;
    }
    setState({ cursorOffset: result.cursorOffset, cursorWidth: result.cursorWidth });
    if (result.value !== originalValue || result.cursorOffset !== cursorOffset) {
      onChange(result.value, result.cursorOffset);
    }
  }, { isActive: focus });

  const value = mask ? mask.repeat(originalValue.length) : originalValue;

  if (!showCursor || !focus) {
    return (
      <Text>
        {placeholder && value.length === 0 ? <Text color="gray">{placeholder}</Text> : value}
      </Text>
    );
  }

  if (value.length === 0) {
    return (
      <Text>
        <Text inverse>{placeholder[0] ?? ' '}</Text>
        {placeholder.length > 1 ? <Text color="gray">{placeholder.slice(1)}</Text> : null}
      </Text>
    );
  }

  const cursorActualWidth = highlightPastedText ? cursorWidth : 0;
  const cursorStart = Math.max(0, cursorOffset - cursorActualWidth);
  const cursorEnd = Math.min(value.length, cursorOffset + 1);
  const before = value.slice(0, cursorStart);
  const cursorText = cursorOffset === value.length ? ' ' : value.slice(cursorStart, cursorEnd);
  const after = cursorOffset === value.length ? '' : value.slice(cursorEnd);

  return (
    <Text>
      {before}
      <Text inverse>{cursorText}</Text>
      {after}
    </Text>
  );
}

export function applyTextInputKey(state: TextInputState, input: string, key: Partial<Key>): TextInputResult {
  const value = state.value;
  const cursorOffset = clampCursorOffset(state.cursorOffset, value);
  let nextValue = value;
  let nextCursorOffset = cursorOffset;
  let nextCursorWidth = 0;

  if (key.upArrow || key.downArrow || (key.ctrl && input === 'c') || key.tab || (key.shift && key.tab)) {
    return { value, cursorOffset, cursorWidth: 0 };
  }

  if (key.return) {
    return { value, cursorOffset, cursorWidth: 0, submitted: value };
  }

  if (key.home) {
    nextCursorOffset = 0;
  } else if (key.end) {
    nextCursorOffset = value.length;
  } else if (key.leftArrow) {
    nextCursorOffset = key.ctrl ? moveWordLeft(value, cursorOffset) : cursorOffset - 1;
  } else if (key.rightArrow) {
    nextCursorOffset = key.ctrl ? moveWordRight(value, cursorOffset) : cursorOffset + 1;
  } else if (key.backspace) {
    if (cursorOffset > 0) {
      nextValue = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
      nextCursorOffset = cursorOffset - 1;
    }
  } else if (key.delete) {
    if (cursorOffset < value.length) {
      nextValue = value.slice(0, cursorOffset) + value.slice(cursorOffset + 1);
    }
  } else if (input.length > 0) {
    nextValue = value.slice(0, cursorOffset) + input + value.slice(cursorOffset);
    nextCursorOffset = cursorOffset + input.length;
    nextCursorWidth = input.length > 1 ? input.length : 0;
  }

  return {
    value: nextValue,
    cursorOffset: clampCursorOffset(nextCursorOffset, nextValue),
    cursorWidth: nextCursorWidth
  };
}

export function clampCursorOffset(cursorOffset: number, value: string): number {
  return Math.max(0, Math.min(value.length, cursorOffset));
}

export function moveWordLeft(value: string, cursorOffset: number): number {
  let index = clampCursorOffset(cursorOffset, value);
  while (index > 0 && isWordSeparator(value[index - 1] ?? '')) {
    index--;
  }
  while (index > 0 && !isWordSeparator(value[index - 1] ?? '')) {
    index--;
  }
  return index;
}

export function moveWordRight(value: string, cursorOffset: number): number {
  let index = clampCursorOffset(cursorOffset, value);
  while (index < value.length && !isWordSeparator(value[index] ?? '')) {
    index++;
  }
  while (index < value.length && isWordSeparator(value[index] ?? '')) {
    index++;
  }
  return index;
}

function isWordSeparator(char: string): boolean {
  return !/[A-Za-z0-9_]/.test(char);
}
