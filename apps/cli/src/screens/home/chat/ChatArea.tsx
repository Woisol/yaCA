import { Box, Text, useStdout } from 'ink';

export type ChatMessage = {
  kind: 'user' | 'assistant' | 'tool' | 'status' | 'error';
  text?: string;
  callId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  status?: 'running' | 'success' | 'error';
  result?: string;
  expanded?: boolean;
};

export function ChatArea({ messages, hasSession }: { messages: ChatMessage[]; hasSession: boolean }) {
  const { stdout } = useStdout();
  return (
    <Box flexDirection="column">
      {!hasSession ? (
        <Box alignItems="center" justifyContent="center" minHeight={stdout.rows - 10}>
          <Text color="gray">Send a message to create a session or use /resume to browse history.</Text>
        </Box>
      ) : messages.length === 0 ? (
        <Box alignItems="center" justifyContent="center" minHeight={stdout.rows - 10}>
          <Text color="gray">No messages yet. Start the conversation by typing!</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          {messages.map((message, index) => <MessageLine key={index} message={message} />)}
        </Box>
      )}
    </Box>
  );
}

function MessageLine({ message }: { message: ChatMessage }) {
  switch (message.kind) {
    case 'user':
      return (
        <Box borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text>{message.text}</Text>
        </Box>
      );
    case 'assistant':
      return (
        <Box>
          <Text color="cyan">assistant: </Text>
          <Text>{message.text}</Text>
        </Box>
      );
    case 'tool':
      return <ToolMessage message={message} />;
    case 'error':
      return (
        <Box>
          <Text color="red">{message.text}</Text>
        </Box>
      );
    case 'status':
      return (
        <Box>
          <Text color="gray">{message.text}</Text>
        </Box>
      );
  }
}

function ToolMessage({ message }: { message: ChatMessage }) {
  const status = message.status ?? 'success';
  const color = status === 'error' ? 'red' : status === 'running' ? 'yellow' : 'green';
  const title = message.toolName
    ? `${message.toolName} ${status === 'running' ? 'executing...' : status}`
    : message.text ?? '';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
      <Text color={color}>{title}</Text>
      {message.args ? <Text color="gray">{JSON.stringify(message.args)}</Text> : null}
      {message.expanded && message.result ? <Text>{message.result}</Text> : null}
    </Box>
  );
}
