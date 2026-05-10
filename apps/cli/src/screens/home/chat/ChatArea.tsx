import { reduceMessageFile } from '../../../api/format/index.js';
import { Box, Text, useStdout } from 'ink';
import type { ChatMessage } from '@yaca/ui';
export type { ChatMessage } from '@yaca/ui';

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
          <Text>{reduceMessageFile(message.text ?? '')}</Text>
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
  const color = status === 'error' ? 'red' : status === 'running' ? 'gray' : 'green';
  const title = message.toolName
    ? `${message.toolName} ${status === 'running' ? 'executing...' : status}`
    : message.text ?? '';

  const toolArgs = message.args ? Object.entries(message.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ') : '';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
      <Box flexDirection="row">
        <Text color={color}>{status === 'error' ? '○' : '●'} </Text>
        <Text color={"gray"}>{title}({toolArgs ? ` ${toolArgs} ` : ''})</Text>
      </Box>
      {message.expanded && message.result ? <Text>{message.result}</Text> : null}
    </Box>
  );
}
