import { Box, Text, useStdout } from "ink";

// 和 @yaca/types 中的 ChatMessage 混淆……
export type ChatMessage = {
  // id: number;
  kind: 'user' | 'assistant' | 'tool' | 'status' | 'error';
  text: string;
};

export function ChatArea({ messages, hasSession }: { messages: ChatMessage[], hasSession: boolean }) {
  const { stdout } = useStdout();
  return <Box flexDirection="column">
    {!hasSession ? (
      <Box alignItems="center" justifyContent="center" minHeight={stdout.rows - 10}>
        <Text color="gray">Send a message to create a session or use /resume to browse history.</Text>
      </Box>
    ) :
      messages.length === 0 ? (
      <Box alignItems="center" justifyContent="center" minHeight={stdout.rows - 10}>
        <Text color="gray">No messages yet. Start the conversation by typing!</Text>
      </Box>

    ) : (
      <Box flexDirection="column" marginBottom={1}>
            {messages.map((message, index) => <MessageLine key={index} message={message} />)}
      </Box>
    )
    }
  </Box>
}
function MessageLine({ message }: { message: ChatMessage }) {
  switch (message.kind) {
    case 'user':
      return (
        <Box borderStyle="round" borderColor={"cyan"} paddingX={1} >
          {/* justifyContent="flex-end" */}
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
      // 需要专门 context 展示细节，例如 toolFunc、toolRes: {success: boolean, output: string}
      // output 默认不展示，按 ctrl+o 展开吧……
      return (
        <Box borderStyle="round" borderBackgroundColor="green" paddingX={1}>
          <Text color="green">{message.text}</Text>
        </Box>
      )
    case 'error':
      return (
        <Box>
          <Text color="red">{message.text}</Text>
        </Box>
      )
  }
}