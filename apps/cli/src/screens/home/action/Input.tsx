import type { Dispatch, SetStateAction } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

type InputProps = {
  input: string;
  focus?: boolean;
  setInput: Dispatch<SetStateAction<string>>;
  onSubmit(text: string): void;
};

export function Input({ input, focus = true, setInput, onSubmit }: InputProps) {
  const isEmpty = input.length === 0;
  return (
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
    </Box>);
}
