import { Document } from '@langchain/core/documents';
import { BaseMessage } from '@langchain/core/messages';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { LLMProviderService } from './llmProvider';
import { EmbeddingsProviderService } from './embeddingsProvider';
import { PostgresVectorStore } from '../utils/postgresVectorStore';
import { pgPool } from '../db/pgPool';
import { ensurePgVectorSchema } from './rag/ragSchema';
import { buildSources, formatSourcesSection, loadDocumentNames } from './rag/ragSources';
import { buildHistoryMessages, buildMessages, buildSystemRules, trimInstructions } from './rag/ragPrompt';

export class RagService {
  async ingestDocument(kbId: string, text: string, metadata: any) {
    await ensurePgVectorSchema(pgPool);
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // LangChain expects an array of metadata objects aligned with texts.
    // Passing a plain object can result in missing per-chunk metadata → "unknown" sources.
    const docs = await splitter.createDocuments([text], [metadata ?? {}]);

    try {
      const embeddings = await EmbeddingsProviderService.getEmbeddings();
      const store = new PostgresVectorStore(embeddings, pgPool, kbId);
      await store.addDocuments(docs);
    } catch (err: any) {
      throw err;
    }
  }

  async query(
    kbId: string,
    question: string,
    promptInstructions: string | null = null,
    historyRaw?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  ) {
    const t0 = Date.now();
    await ensurePgVectorSchema(pgPool);
    const tSchema = Date.now();
    const embeddings = await EmbeddingsProviderService.getEmbeddings();
    const store = new PostgresVectorStore(embeddings, pgPool, kbId);

    const tEmbModel = Date.now();
    const queryVector = await embeddings.embedQuery(question);
    const tEmbed = Date.now();
    const envTopK = Number(process.env.RAG_TOP_K || 4);
    const topK = Number.isFinite(envTopK) ? Math.min(Math.max(envTopK, 2), 12) : 4;
    const results = await store.similaritySearchVectorWithScore(queryVector, topK);
    const tSearch = Date.now();
    if (results.length === 0) {
      return 'No documents found in this knowledge base. Please upload PDF documents first.';
    }
    const docIds = results
      .map(([doc]: [Document, number]) => (doc.metadata?.documentId ? String(doc.metadata.documentId) : null))
      .filter(Boolean) as string[];
    const docNameMap = await loadDocumentNames(Array.from(new Set(docIds)));
    const { sources, context } = buildSources(results, docNameMap);

    const maxInstrChars = Number(process.env.RAG_MAX_INSTRUCTIONS_CHARS || 6000);
    const trimmedInstructions = trimInstructions(promptInstructions, maxInstrChars);
    const systemRules = buildSystemRules(trimmedInstructions);
    const history: BaseMessage[] = buildHistoryMessages(historyRaw);
    const messages: BaseMessage[] = buildMessages({ systemRules, history, context, question });

    const llm: any = await LLMProviderService.getLLM();
    try {
      const tLLMStart = Date.now();
      const response = await llm.invoke(messages);
      const tLLMEnd = Date.now();
      const answer = (response as any)?.content ?? String(response);
      const sourcesSection = formatSourcesSection(sources);
      if (process.env.RAG_DEBUG_TIMINGS === '1') {
        console.log('[ragService.query] timings', {
          kbId,
          topK,
          questionChars: question?.length || 0,
          instructionsChars: trimmedInstructions?.length || 0,
          contextChars: context?.length || 0,
          msTotal: Date.now() - t0,
          msEnsureSchema: tSchema - t0,
          msGetEmbeddingsModel: tEmbModel - tSchema,
          msEmbedQuery: tEmbed - tEmbModel,
          msVectorSearch: tSearch - tEmbed,
          msLLM: tLLMEnd - tLLMStart,
        });
      }
      return `${answer}${sourcesSection}`;
    } catch (e) {
      // Fallback for providers/configs that don't accept structured chat messages
      const prompt = `${systemRules}\n\n${history
        .map((m) => {
          const t = (m as any)?._getType?.() || (m as any)?.constructor?.name || 'message';
          return `${t}: ${(m as any).content}`;
        })
        .join('\n')}\n\nCONTEXT:\n\n${context}\n\nQUESTION: ${question}\n\nReturn Markdown MD.`;
      const tLLMStart = Date.now();
      const response = await llm.invoke(prompt);
      const tLLMEnd = Date.now();
      const answer = (response as any)?.content ?? String(response);
      const sourcesSection = formatSourcesSection(sources);
      if (process.env.RAG_DEBUG_TIMINGS === '1') {
        console.log('[ragService.query] timings', {
          kbId,
          topK,
          questionChars: question?.length || 0,
          instructionsChars: trimmedInstructions?.length || 0,
          contextChars: context?.length || 0,
          msTotal: Date.now() - t0,
          msEnsureSchema: tSchema - t0,
          msGetEmbeddingsModel: tEmbModel - tSchema,
          msEmbedQuery: tEmbed - tEmbModel,
          msVectorSearch: tSearch - tEmbed,
          msLLM: tLLMEnd - tLLMStart,
          usedFallback: true,
        });
      }
      return `${answer}${sourcesSection}`;
    }
  }

  async deleteKnowledgeBase(kbId: string) {
    await ensurePgVectorSchema(pgPool);
    const embeddings = await EmbeddingsProviderService.getEmbeddings();
    const store = new PostgresVectorStore(embeddings, pgPool, kbId);
    await store.deleteByKnowledgeBase();
  }

  async deleteDocument(kbId: string, documentId: string) {
    await ensurePgVectorSchema(pgPool);
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
