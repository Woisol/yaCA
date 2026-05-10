export {
  appendAssistantDelta,
  appendAssistantEvent,
  appendChatLine,
  applyAssistantEventPatch,
  applyToolCall,
  applyToolResult,
  replaceAssistantText,
  setToolOutputExpanded
} from './chat/messages.js';
export type { ChatMessage } from './chat/types.js';

export {
  chatMessagesToStored,
  formatMessagePart,
  formatStoredMessageContent,
  reduceMessageFile,
  reduceMessageFileToPathMention
} from './format/message-format.js';

export {
  appendStoredToolMessage,
  applyRewindSelection,
  renderSessionMessages
} from './session/messages.js';
