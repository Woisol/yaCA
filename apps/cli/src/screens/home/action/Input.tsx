import { Box, Text } from "ink";

export function Input({ input }: { input: string }) {
  const isEmpty = input.length === 0;
  return (
    <Box borderColor={isEmpty ? "grey" : "white"} borderStyle="round" paddingX={1}>
      <Text color="cyan">yaca&gt; </Text>
      <Text color={isEmpty ? "grey" : "white"}>{isEmpty ? "Enter something creative..." : input}</Text>
    </Box>);
}