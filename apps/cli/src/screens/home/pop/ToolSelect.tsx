import { Box, Text, useInput } from "ink";
import { useState } from "react";

export interface ToolSelectProps {
  tools: string[],
  allowTools: string[],
  onSelect(tool: string): void,
  onQuit(): void
}
export function ToolSelect({ tools, allowTools, onSelect, onQuit }: ToolSelectProps) {
  const disabledTools = tools.filter(tool => !allowTools.includes(tool));
  const [curIndex, setCurIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setCurIndex((cur) => Math.max(0, cur - 1));
    } else if (key.downArrow) {
      setCurIndex((cur) => Math.min(tools.length - 1, cur + 1));
    } else if (key.return) {
      const selected = [...allowTools, ...disabledTools][curIndex];
      if (selected) onSelect(selected);
    } else if (key.escape) {
      onQuit();
    }
  });
  return (
    <Box flexDirection="column">
      {allowTools.map(tool => (
        <Text key={tool} color={curIndex === allowTools.indexOf(tool) ? "white" : "cyan"} backgroundColor={curIndex === allowTools.indexOf(tool) ? "cyanBright" : undefined}>
          {tool}
        </Text>
      ))}
      {disabledTools.map(tool => (
        <Text key={tool} color={curIndex === allowTools.length + disabledTools.indexOf(tool) ? "white" : "gray"} backgroundColor={curIndex === allowTools.length + disabledTools.indexOf(tool) ? "blackBright" : undefined}>
          {tool} (disabled)
        </Text>
      ))}
    </Box>
  )
}