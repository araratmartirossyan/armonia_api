import { Embeddings } from '@langchain/core/embeddings'
import { OpenAIEmbeddings } from '@langchain/openai'

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small' // 1536 dimensions

export class EmbeddingsProviderService {
  private static cached: Embeddings | null = null
  static async getEmbeddings(): Promise<Embeddings> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in environment variables')
    }

    // Force using OpenAI embeddings for pgvector compatibility (1536 dims)
    if (!EmbeddingsProviderService.cached) {
      EmbeddingsProviderService.cached = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        model: OPENAI_EMBEDDING_MODEL,
      })
    }
    return EmbeddingsProviderService.cached
  }
}
