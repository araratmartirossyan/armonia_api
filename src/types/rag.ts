import { BaseMessage } from '@langchain/core/messages'

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatHistoryItem = {
  role: ChatRole
  content: string
}

export type IngestMetadata = Record<string, unknown> | null

export type KbScore = {
  kbId: string | null
  score: number
}

export type BuildMessagesParams = {
  systemRules: string
  history: BaseMessage[]
  context: string
  question: string
}

export type BuildGlobalMessagesParams = {
  systemRules: string
  history: BaseMessage[]
  question: string
}
