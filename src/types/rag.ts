export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type IngestMetadata = Record<string, unknown> | null;
