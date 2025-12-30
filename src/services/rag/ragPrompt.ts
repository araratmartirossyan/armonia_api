import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { BuildGlobalMessagesParams, BuildMessagesParams, ChatHistoryItem } from '../../types/rag'

export function trimInstructions(
  promptInstructions: string | null,
  maxChars: number,
): string | null {
  if (!promptInstructions) return null
  if (!Number.isFinite(maxChars) || maxChars <= 0) return promptInstructions
  return promptInstructions.slice(0, maxChars)
}

export function buildSystemRules(trimmedInstructions: string | null): string {
  return [
    trimmedInstructions ? `Knowledge base instructions:\n${trimmedInstructions}` : null,
    `You are a RAG assistant. Answer using ONLY the provided CONTEXT and the conversation history.`,
    `Return the answer in Markdown ONLY.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildGlobalSystemRules(trimmedInstructions: string | null): string {
  return [
    trimmedInstructions ? `Global instructions:\n${trimmedInstructions}` : null,
    `You are an assistant. The user has no knowledge base attached, so you must answer using general knowledge.`,
    `If you are unsure, say so and ask a clarifying question. Do not invent citations.`,
    `Return the answer in Markdown ONLY.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildHistoryMessages(historyRaw?: ChatHistoryItem[]): BaseMessage[] {
  const history: BaseMessage[] = []
  if (!Array.isArray(historyRaw)) return history

  for (const item of historyRaw.slice(-12)) {
    if (!item?.content) continue
    if (item.role === 'system') history.push(new SystemMessage(String(item.content)))
    else if (item.role === 'assistant') history.push(new AIMessage(String(item.content)))
    else history.push(new HumanMessage(String(item.content)))
  }

  return history
}

export function buildMessages(params: BuildMessagesParams): BaseMessage[] {
  return [
    new SystemMessage(params.systemRules),
    ...params.history,
    new HumanMessage(
      `CONTEXT:\n\n${params.context}\n\nUSER QUESTION:\n${params.question}\n\nRemember: output Markdown.`,
    ),
  ]
}

export function buildGlobalMessages(params: BuildGlobalMessagesParams): BaseMessage[] {
  return [
    new SystemMessage(params.systemRules),
    ...params.history,
    new HumanMessage(`USER QUESTION:\n${params.question}\n\nRemember: output Markdown.`),
  ]
}

/**
 * Extracts text content from a LangChain response object.
 */
export function extractText(resp: unknown): string {
  if (resp && typeof resp === 'object' && 'content' in resp) {
    const c = (resp as { content?: unknown }).content
    if (typeof c === 'string') return c
  }
  return String(resp)
}

/**
 * Formats an array of BaseMessages into a plain text string for fallback prompts.
 */
export function formatMessagesForPrompt(messages: BaseMessage[]): string {
  return messages
    .map(m => {
      const typeName =
        typeof (m as unknown as { _getType?: () => string })._getType === 'function'
          ? (m as unknown as { _getType: () => string })._getType()
          : (m as object).constructor?.name || 'message'
      return `${typeName}: ${String((m as unknown as { content?: unknown }).content ?? '')}`
    })
    .join('\n')
}
