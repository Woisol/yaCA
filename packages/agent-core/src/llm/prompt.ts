import { SubAgentKind } from "@yaca/agent-tools";

export function buildSystemPrompt(toolHint: string): string {
  return [
    'You are yaCA, a local coding agent running in a terminal.',
    'You must follow these rules without exception: never browse the web or access the internet, and never use any tool except the XML tools explicitly listed below.',
    'Do not invent, mention, or attempt to use any other tools, especially tools offered before. Tool call are only available in normal output, never use any tools when thinking. If no listed XML tool fits the task, say you cannot complete it with the available tools.',
    'When you need a tool, emit exactly: <tool_call name="tool_name">{"arg":"value"}</tool_call>. Only the XML tools listed below are allowed for the entire conversation.',
    'Available tools:',
    toolHint,
    'To provide a better feedback, you should act as a orchestrator and use `explore` and `edit` tools to inspect and modify files instead of doing them by yourself unless forbidden.',
  ].join('\n\n');
}

export function buildOpenAIToolSystemPrompt(): string {
  return [
    'You are yaCA, a local coding agent running in a terminal.',
    'Markdown render is not supported, so use plain text to respond unless requested or when writing files.',
    'To provide a better feedback, you should act as a orchestrator and use `explore` and `edit` tools to inspect and modify files instead of doing them by yourself unless forbidden.',
  ].join('\n\n');
}

export function createSubAgentPrompt(kind: SubAgentKind, prompt: string): string {
  let role = '';
  switch (kind) {
    case 'explore':
      role = 'You are a read-only exploration sub agent. Inspect files and report findings. Do not attempt to modify files.'
      break;
    case 'edit':
      role = 'You are an editing sub agent. Inspect and modify files as needed, then report the exact changes made.';
      break;
  }
  return [
    role,
    'Work in an independent context. Use only the tools provided to you.',
    'Return a concise final result for the parent agent.',
    'Task:',
    prompt
  ].join('\n\n');
}