import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { applyPathCompletion, getPathCompletionState, type PathCompletionState } from './path-completions.js';

type InputProps = {
  input: string;
  cwd: string;
  focus?: boolean;
  setInput: Dispatch<SetStateAction<string>>;
  onCompletionOpenChange?(open: boolean): void;
  onSubmit(text: string): void;
};

export function Input({ input, cwd, focus = true, setInput, onCompletionOpenChange, onSubmit }: InputProps) {
  const isEmpty = input.length === 0;
  const [completion, setCompletion] = useState<PathCompletionState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const completionOpen = focus && completion !== null && completion.items.length > 0;

  useEffect(() => {
    let cancelled = false;
    if (!focus) {
      setCompletion(null);
      return;
    }

    void getPathCompletionState(input, cwd).then((next) => {
      if (cancelled) return;
      setCompletion(next);
      setSelectedIndex(0);
    });

    return () => {
      cancelled = true;
    };
  }, [input, cwd, focus]);

  useEffect(() => {
    onCompletionOpenChange?.(completionOpen);
  }, [completionOpen, onCompletionOpenChange]);

  useInput((_typed, key) => {
    if (!completionOpen || !completion) return;
    if (key.upArrow) {
      setSelectedIndex((current) => Math.max(0, current - 1));
    } else if (key.downArrow) {
      setSelectedIndex((current) => Math.min(completion.items.length - 1, current + 1));
    } else if (key.tab) {
      setInput(applyPathCompletion(input, completion, selectedIndex));
      setCompletion(null);
    }
  }, { isActive: focus });

  return (
    <Box flexDirection="column">
      <Box borderColor={isEmpty ? 'gray' : 'gray'} borderStyle="round" paddingX={1}>
        <Text color="cyan">yaca&gt; </Text>
        <TextInput
          focus={focus}
          highlightPastedText
          placeholder="Enter something creative..."
          showCursor
          value={input}
          onChange={setInput}
          onSubmit={onSubmit}
        />
      </Box>
      {completionOpen ? (
        <Box flexDirection="column" marginLeft={2}>
          {completion.items.map((item, index) => (
            <Box key={`${item.value}-${index}`} backgroundColor={index === selectedIndex ? 'cyanBright' : undefined} paddingX={1}>
              <Text color={index === selectedIndex ? 'black' : 'gray'}>
                {item.display}
              </Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>);
}
