import { Document } from '@langchain/core/documents';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { LLMProvider } from '../entities/KnowledgeBase';
import { LLMProviderService } from './llmProvider';
import { EmbeddingsProviderService } from './embeddingsProvider';
import { AppDataSource } from '../data-source';
import { Configuration } from '../entities/Configuration';
import { PostgresVectorStore } from '../utils/postgresVectorStore';
import { pgPool } from '../db/pgPool';

const configRepository = AppDataSource.getRepository(Configuration);
const DEFAULT_CONFIG_KEY = 'default';

const getGlobalConfig = async (): Promise<Configuration> => {
  let config = await configRepository.findOne({ where: { key: DEFAULT_CONFIG_KEY } });
  if (!config) {
    config = configRepository.create({
      key: DEFAULT_CONFIG_KEY,
      llmProvider: LLMProvider.OPENAI,
      // Strong defaults for RAG (can be changed via config endpoints)
      model: 'gpt-4o',
      temperature: 0.1,
      maxTokens: 1200,
      topP: 1,
      topK: null,
      frequencyPenalty: 0,
      presencePenalty: 0,
      stopSequences: null,
    });
    await configRepository.save(config);
  }
  return config;
};

// Ensure pgvector schema exists (run once per process)
let pgVectorInitialized = false;
const PGVECTOR_DIMENSION = 1536; // text-embedding-3-small

export class RagService {
  private async ensurePgVectorSchema() {
    if (pgVectorInitialized) return;
    const client = await pgPool.connect();
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS kb_documents (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          kb_id text NOT NULL,
          content text NOT NULL,
          metadata jsonb,
          embedding vector(${PGVECTOR_DIMENSION}) NOT NULL
        );
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS kb_documents_kb_id_idx ON kb_documents (kb_id);`);
      await client.query(`
        CREATE INDEX IF NOT EXISTS kb_documents_embedding_idx
        ON kb_documents
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);
      pgVectorInitialized = true;
    } finally {
      client.release();
    }
  }

  async ingestDocument(kbId: string, text: string, metadata: any) {
    const start = Date.now();
    console.log('[ragService.ingestDocument] start', {
      kbId,
      textLength: text?.length,
    });
    await this.ensurePgVectorSchema();
    const config = await getGlobalConfig();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await splitter.createDocuments([text], metadata);
    console.log('[ragService.ingestDocument] split docs', {
      kbId,
      chunkCount: docs.length,
      metadataKeys: Object.keys(metadata || {}),
    });
    try {
      console.log('[ragService.ingestDocument] get embeddings', { kbId });
      const embeddings = await EmbeddingsProviderService.getEmbeddings();
      console.log('[ragService.ingestDocument] got embeddings', { kbId });
      const store = new PostgresVectorStore(embeddings, pgPool, kbId);
      console.log('[ragService.ingestDocument] add documents', { kbId, rows: docs.length });
      await store.addDocuments(docs);
      console.log('[ragService.ingestDocument] stored embeddings', {
        kbId,
        rows: docs.length,
        ms: Date.now() - start,
      });
    } catch (err: any) {
      console.error('[ragService.ingestDocument] error', {
        kbId,
        message: err?.message,
      });
      throw err;
    }
  }

  async query(
    kbId: string,
    question: string,
    promptInstructions: string | null = null,
    historyRaw?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  ) {
    await this.ensurePgVectorSchema();
    const embeddings = await EmbeddingsProviderService.getEmbeddings();
    const store = new PostgresVectorStore(embeddings, pgPool, kbId);

    const queryVector = await embeddings.embedQuery(question);
    const topK = Number(process.env.RAG_TOP_K || 8);
    const results = await store.similaritySearchVectorWithScore(queryVector, Number.isFinite(topK) ? topK : 8);
    if (results.length === 0) {
      return 'No documents found in this knowledge base. Please upload PDF documents first.';
    }
    const context = results
      .map(([doc, score]: [Document, number], idx: number) => {
        const sourceParts: string[] = [];
        if (doc.metadata?.fileName) sourceParts.push(String(doc.metadata.fileName));
        if (doc.metadata?.documentId) sourceParts.push(`documentId=${doc.metadata.documentId}`);
        const source = sourceParts.length ? sourceParts.join(' | ') : 'unknown';
        return `### Source ${idx + 1} (score=${score.toFixed(4)}): ${source}\n\n${doc.pageContent}`;
      })
      .join('\n\n---\n\n');

    const systemRules = [
      promptInstructions ? `Knowledge base instructions:\n${promptInstructions}` : null,
      `You are a RAG assistant. Answer using ONLY the provided CONTEXT and the conversation history.`,
      `If the answer is not in the context, say: "I don't have that information in the uploaded documents."`,
      `Return the answer in Markdown.`,
      `When possible, include a short "Sources" section listing which Source numbers you used.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const history: BaseMessage[] = [];
    if (Array.isArray(historyRaw)) {
      for (const item of historyRaw.slice(-12)) {
        if (!item?.content) continue;
        if (item.role === 'system') history.push(new SystemMessage(String(item.content)));
        else if (item.role === 'assistant') history.push(new AIMessage(String(item.content)));
        else history.push(new HumanMessage(String(item.content)));
      }
    }

    const messages: BaseMessage[] = [
      new SystemMessage(systemRules),
      ...history,
      new HumanMessage(`CONTEXT:\n\n${context}\n\nUSER QUESTION:\n${question}\n\nRemember: output Markdown.`),
    ];

    const llm: any = await LLMProviderService.getLLM();
    try {
      const response = await llm.invoke(messages);
      return (response as any)?.content ?? String(response);
    } catch (e) {
      // Fallback for providers/configs that don't accept structured chat messages
      const prompt = `${systemRules}\n\n${history
        .map((m) => {
          const t = (m as any)?._getType?.() || (m as any)?.constructor?.name || 'message';
          return `${t}: ${(m as any).content}`;
        })
        .join('\n')}\n\nCONTEXT:\n\n${context}\n\nQUESTION: ${question}\n\nReturn Markdown.`;
      const response = await llm.invoke(prompt);
      return (response as any)?.content ?? String(response);
    }
  }

  async deleteKnowledgeBase(kbId: string) {
    await this.ensurePgVectorSchema();
    const embeddings = await EmbeddingsProviderService.getEmbeddings();
    const store = new PostgresVectorStore(embeddings, pgPool, kbId);
    await store.deleteByKnowledgeBase();
  }

  async deleteDocument(kbId: string, documentId: string) {
    await this.ensurePgVectorSchema();
    const client = await pgPool.connect();
    try {
      await client.query(`DELETE FROM kb_documents WHERE kb_id = $1 AND (metadata->>'documentId') = $2`, [
        kbId,
        documentId,
      ]);
    } finally {
      client.release();
    }
  }
}

export const ragService = new RagService();
