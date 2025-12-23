import { Document } from '@langchain/core/documents';
import { BaseMessage } from '@langchain/core/messages';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { LLMProviderService } from './llmProvider';
import { EmbeddingsProviderService } from './embeddingsProvider';
import { PostgresVectorStore } from '../utils/postgresVectorStore';
import { pgPool } from '../db/pgPool';
import { ensurePgVectorSchema } from './rag/ragSchema';
import { buildSources, formatSourcesSection, loadDocumentNames } from './rag/ragSources';
import {
  buildGlobalMessages,
  buildGlobalSystemRules,
  buildHistoryMessages,
  buildMessages,
  buildSystemRules,
  trimInstructions,
} from './rag/ragPrompt';
import { getDefaultAIConfig } from './configService';
import { LLMProvider } from '../entities/KnowledgeBase';
import { openAIWebSearchAnswer } from './openaiWebSearch';
import { GLOBAL_FALLBACK_PROMPT_INSTRUCTIONS } from './rag/globalPrompt';
import type { ChatHistoryItem, IngestMetadata } from '../types/rag';

export class RagService {
  async ingestDocument(kbId: string, text: string, metadata: IngestMetadata) {
    await ensurePgVectorSchema(pgPool);
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // LangChain expects an array of metadata objects aligned with texts.
    // Passing a plain object can result in missing per-chunk metadata → "unknown" sources.
    const docs = await splitter.createDocuments([text], [metadata ?? {}]);

    const embeddings = await EmbeddingsProviderService.getEmbeddings();
    const store = new PostgresVectorStore(embeddings, pgPool, kbId);
    await store.addDocuments(docs);
  }

  async query(
    kbId: string,
    question: string,
    promptInstructions: string | null = null,
    historyRaw?: ChatHistoryItem[],
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
      // If KB has no vectors yet, fall back to global knowledge using KB instructions.
      return await this.queryGlobal(question, promptInstructions, historyRaw);
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

    const llm: BaseLanguageModel = await LLMProviderService.getLLM();
    const toText = (resp: unknown): string => {
      if (resp && typeof resp === 'object' && 'content' in resp) {
        const c = (resp as { content?: unknown }).content;
        if (typeof c === 'string') return c;
      }
      return String(resp);
    };
    try {
      const response = await llm.invoke(messages);
      const answer = toText(response);
      const sourcesSection = formatSourcesSection(sources);
      return `${answer}${sourcesSection}`;
    } catch {
      // Fallback for providers/configs that don't accept structured chat messages
      const prompt = `${systemRules}\n\n${history
        .map((m) => {
          const typeName =
            typeof (m as unknown as { _getType?: () => string })._getType === 'function'
              ? (m as unknown as { _getType: () => string })._getType()
              : (m as object).constructor?.name || 'message';
          return `${typeName}: ${String((m as unknown as { content?: unknown }).content ?? '')}`;
        })
        .join('\n')}\n\nCONTEXT:\n\n${context}\n\nQUESTION: ${question}\n\nReturn Markdown MD.`;
      const response = await llm.invoke(prompt);
      const answer = toText(response);
      const sourcesSection = formatSourcesSection(sources);
      return `${answer}${sourcesSection}`;
    }
  }

  async queryGlobal(question: string, promptInstructions: string | null = null, historyRaw?: ChatHistoryItem[]) {
    const maxInstrChars = Number(process.env.RAG_MAX_INSTRUCTIONS_CHARS || 6000);
    const trimmedInstructions = trimInstructions(
      promptInstructions ?? GLOBAL_FALLBACK_PROMPT_INSTRUCTIONS,
      maxInstrChars,
    );

    const systemRules = buildGlobalSystemRules(trimmedInstructions);

    // If using OpenAI, prefer the first-party web_search tool (model decides whether to search).
    // For other providers, fall back to the existing provider LLM-only global mode.
    const cfg = await getDefaultAIConfig();
    const provider = cfg.llmProvider || LLMProvider.OPENAI;
    const modelName = cfg.model || 'gpt-4o';

    if (provider === LLMProvider.OPENAI && process.env.OPENAI_API_KEY) {
      const history: ChatHistoryItem[] = Array.isArray(historyRaw) ? historyRaw.slice(-12) : [];
      const { answerMarkdown, citations } = await openAIWebSearchAnswer({
        apiKey: process.env.OPENAI_API_KEY,
        model: modelName,
        systemRules,
        question,
        history,
        maxOutputTokens: cfg.maxTokens ?? 1200,
        temperature: cfg.temperature ?? null,
        topP: cfg.topP ?? null,
        frequencyPenalty: cfg.frequencyPenalty ?? null,
        presencePenalty: cfg.presencePenalty ?? null,
        externalWebAccess: process.env.RAG_GLOBAL_WEB_OFFLINE === '1' ? false : undefined,
      });

      const sourcesSection =
        citations.length > 0
          ? `\n\nSources:\n${citations
              .map((c, idx) => `- Source ${idx + 1}: ${c.title ? `[${c.title}](${c.url})` : c.url}`)
              .join('\n')}`
          : '';

      return `${answerMarkdown}${sourcesSection}`;
    }

    const history: BaseMessage[] = buildHistoryMessages(historyRaw);
    const messages: BaseMessage[] = buildGlobalMessages({ systemRules, history, question });

    const llm: BaseLanguageModel = await LLMProviderService.getLLM();
    const toText = (resp: unknown): string => {
      if (resp && typeof resp === 'object' && 'content' in resp) {
        const c = (resp as { content?: unknown }).content;
        if (typeof c === 'string') return c;
      }
      return String(resp);
    };
    try {
      const response = await llm.invoke(messages);
      const answer = toText(response);
      // No doc sources in global mode; keep output clean.
      return answer;
    } catch {
      const prompt = `${systemRules}\n\n${history
        .map((m) => {
          const typeName =
            typeof (m as unknown as { _getType?: () => string })._getType === 'function'
              ? (m as unknown as { _getType: () => string })._getType()
              : (m as object).constructor?.name || 'message';
          return `${typeName}: ${String((m as unknown as { content?: unknown }).content ?? '')}`;
        })
        .join('\n')}\n\nQUESTION: ${question}\n\nReturn Markdown MD.`;
      const response = await llm.invoke(prompt);
      const answer = toText(response);
      return answer;
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
