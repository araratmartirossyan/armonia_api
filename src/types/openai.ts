import { ChatHistoryItem } from './rag'

export type OpenAIWebSearchTool = {
  type: 'web_search'
  external_web_access?: boolean
}

export type OpenAIResponsesCreateRequest = {
  model: string
  input: ChatHistoryItem[]
  tools?: OpenAIWebSearchTool[]
  max_output_tokens?: number
  temperature?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
}

export type OpenAIUrlCitationAnnotation = {
  type: 'url_citation' | 'url-citation'
  url?: string
  title?: string
  url_citation?: { url?: string; title?: string }
}

export type OpenAIMessageContentPart = {
  type?: string
  text?: string
  content?: string
  annotations?: OpenAIUrlCitationAnnotation[]
}

export type OpenAIOutputItem =
  | {
      type: 'message'
      content?: OpenAIMessageContentPart[]
    }
  | {
      type: string
      // other tool outputs (e.g., web_search_call) are ignored for text extraction
      [k: string]: unknown
    }

export type OpenAIResponsesCreateResponse = {
  output_text?: string
  output?: OpenAIOutputItem[]
}

export type WebSearchParams = {
  apiKey: string
  model: string
  systemRules: string
  question: string
  history?: ChatHistoryItem[]
  maxOutputTokens?: number
  temperature?: number | null
  topP?: number | null
  frequencyPenalty?: number | null
  presencePenalty?: number | null
  externalWebAccess?: boolean
}

export type OpenAIWebSearchResponse = {
  answerMarkdown: string
}
