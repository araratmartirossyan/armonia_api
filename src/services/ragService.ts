import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { SimpleMemoryVectorStore } from '../utils/simpleVectorStore';
import { LLMProvider } from '../entities/KnowledgeBase';
import { LLMProviderService } from './llmProvider';
import { EmbeddingsProviderService } from './embeddingsProvider';
import { AppDataSource } from '../data-source';
import { Configuration } from '../entities/Configuration';

const configRepository = AppDataSource.getRepository(Configuration);
const DEFAULT_CONFIG_KEY = 'default';

const getGlobalConfig = async (): Promise<Configuration> => {
  let config = await configRepository.findOne({ where: { key: DEFAULT_CONFIG_KEY } });
  if (!config) {
    config = configRepository.create({
      key: DEFAULT_CONFIG_KEY,
      llmProvider: LLMProvider.OPENAI,
      model: null,
      temperature: null,
      maxTokens: null,
      topP: null,
      topK: null,
      frequencyPenalty: null,
      presencePenalty: null,
      stopSequences: null,
    });
    await configRepository.save(config);
  }
  return config;
};

// In-memory store for demonstration. In production, use a persistent vector DB.
// We map kbId -> VectorStore (each Knowledge Base has its own vector store)
const vectorStores: Map<string, SimpleMemoryVectorStore> = new Map();

export class RagService {
  async ingestDocument(kbId: string, text: string, metadata: any) {
    const config = await getGlobalConfig();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await splitter.createDocuments([text], metadata);
    const embeddings = await EmbeddingsProviderService.getEmbeddings(config.llmProvider || LLMProvider.OPENAI);

    let store = vectorStores.get(kbId);
    if (!store) {
      store = await SimpleMemoryVectorStore.fromDocuments(docs, embeddings);
      vectorStores.set(kbId, store);
    } else {
      await store.addDocuments(docs);
    }
  }

  async query(kbId: string, question: string, promptInstructions: string | null = null) {
    const store = vectorStores.get(kbId);
    if (!store) {
      return 'No documents found in this knowledge base. Please upload PDF documents first.';
    }

    // Simple retrieval
    const results = await store.similaritySearch(question, 4);
    const context = results.map((doc: Document) => doc.pageContent).join('\n\n');

    // Build prompt with custom instructions if provided
    let prompt = '';
    if (promptInstructions) {
      prompt = `${promptInstructions}\n\n`;
    }
    prompt += `Answer the question based only on the following context:\n\n${context}\n\nQuestion: ${question}`;

    const llm = await LLMProviderService.getLLM();
    const response = await llm.invoke(prompt);
    return response.content;
  }

  async deleteKnowledgeBase(kbId: string) {
    // Remove vector store for this knowledge base
    vectorStores.delete(kbId);
  }
}

export const ragService = new RagService();
