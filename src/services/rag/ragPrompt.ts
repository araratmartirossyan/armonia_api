import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

export function trimInstructions(promptInstructions: string | null, maxChars: number): string | null {
  if (!promptInstructions) return null;
  if (!Number.isFinite(maxChars) || maxChars <= 0) return promptInstructions;
  return promptInstructions.slice(0, maxChars);
}

export function buildSystemRules(trimmedInstructions: string | null): string {
  return [
    trimmedInstructions ? `Knowledge base instructions:\n${trimmedInstructions}` : null,
    `You are a RAG assistant. Answer using ONLY the provided CONTEXT and the conversation history.`,
    `Return the answer in Markdown ONLY.`,
    `Do NOT add your own "Sources" section. The system will append canonical Sources separately.`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildHistoryMessages(
  historyRaw?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
): BaseMessage[] {
  const history: BaseMessage[] = [];
  if (!Array.isArray(historyRaw)) return history;

  for (const item of historyRaw.slice(-12)) {
    if (!item?.content) continue;
    if (item.role === 'system') history.push(new SystemMessage(String(item.content)));
    else if (item.role === 'assistant') history.push(new AIMessage(String(item.content)));
    else history.push(new HumanMessage(String(item.content)));
  }

  return history;
}

export function buildMessages(params: {
  systemRules: string;
  history: BaseMessage[];
  context: string;
  question: string;
}): BaseMessage[] {
  return [
    new SystemMessage(params.systemRules),
    ...params.history,
    new HumanMessage(
      `CONTEXT:\n\n${params.context}\n\nUSER QUESTION:\n${params.question}\n\nRemember: output Markdown.`,
    ),
  ];
}
