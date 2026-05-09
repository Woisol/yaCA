import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { ChatMessage } from '../chat/ChatArea.js';
import { reduceMessageFile } from '@yaca/cli/api/message-utils.js';

export function Rewind({
  messages,
  onMessageSelect,
  onQuit
}: {
  messages: ChatMessage[];
  onMessageSelect(index: number): void;
  onQuit(): void;
}) {
  const userMessages = messages
    .map((message, index) => ({ message, index }))
    .filter((item) => item.message.kind === 'user');
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, userMessages.length - 1));

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex((current) => Math.max(0, current - 1));
    } else if (key.downArrow) {
      setSelectedIndex((current) => Math.min(userMessages.length - 1, current + 1));
    } else if (key.return) {
      const selected = userMessages[selectedIndex];
      if (selected) onMessageSelect(selected.index);
    } else if (key.escape) {
      onQuit();
    }
  });

  return (
    <Box flexDirection="column">
      {userMessages.length === 0 ? (
        <Text color="gray">No user messages in the current conversation.</Text>
      ) : (
        userMessages.map(({ message, index }, listIndex) => (
          <Box key={index} backgroundColor={listIndex === selectedIndex ? 'yellowBright' : undefined} paddingX={1}>
            <Text color={listIndex === selectedIndex ? 'black' : undefined}>
              {reduceMessageFile(message.text ?? '')}
            </Text>
          </Box>
        ))
      )}
    </Box>
  );
}
