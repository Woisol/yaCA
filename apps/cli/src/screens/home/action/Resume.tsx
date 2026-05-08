import { SessionMeta } from "@yaca/agent-core/storage/session-store.js";
import { Box, Text, useInput } from "ink";
import { useState } from "react";

export function Resume({ sessions, onSessionSelect, onQuit }: { sessions: SessionMeta[]; onSessionSelect(sessionId: string): void; onQuit(): void }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((current) => Math.max(0, current - 1));
    } else if (key.downArrow) {
      setSelectedIndex((current) => Math.min(sessions.length - 1, current + 1));
    } else if (key.return) {
      const session = sessions[selectedIndex];
      onSessionSelect(session.id);
    } else if (key.escape) {
      onSessionSelect('');
      onQuit();
    }
  });
  return (
    <Box flexDirection="column">
      {sessions.length === 0 ? (
        <Text color="grey">No sessions found. Start a new one by sending a message.</Text>
      ) : (
        sessions.map((session, index) => (
          <Box key={session.id} backgroundColor={index === selectedIndex ? "cyanBright" : undefined} paddingX={1}>
            <Text color={index === selectedIndex ? "black" : undefined}>
              {session.name}
            </Text>
          </Box>
        ))
      )}
    </Box>
  )
}