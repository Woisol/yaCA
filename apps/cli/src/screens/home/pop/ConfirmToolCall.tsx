import { Box, Text, useInput } from "ink";
import { useState } from "react";

export interface ConfirmToolCallProps {
  title: string;
  detail?: string;
  onSelect(approved: boolean): void;
}

export function ConfirmToolCall({ title, detail, onSelect }: ConfirmToolCallProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const options = ['Yes', 'No'];

  useInput((input, key) => {
    if (key.leftArrow || key.upArrow) {
      setSelectedIndex((current) => Math.max(0, current - 1));
    } else if (key.rightArrow || key.downArrow || key.tab) {
      setSelectedIndex((current) => Math.min(options.length - 1, current + 1));
    } else if (key.return) {
      onSelect(selectedIndex === 0);
    } else if (key.escape || input.toLowerCase() === 'n') {
      onSelect(false);
    } else if (input.toLowerCase() === 'y') {
      onSelect(true);
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="yellow">{title}</Text>
      {detail ? <Text color="gray">{detail}</Text> : null}
      <Box>
        {options.map((option, index) => (
          <Box key={option} backgroundColor={selectedIndex === index ? "cyanBright" : undefined} paddingX={1} marginRight={1}>
            <Text color={selectedIndex === index ? "black" : undefined}>{option}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
