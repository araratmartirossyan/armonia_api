import { AppDataSource } from '../data-source';
import { Configuration } from '../entities/Configuration';
import { LLMProvider } from '../entities/KnowledgeBase';

const configRepository = AppDataSource.getRepository(Configuration);

const DEFAULT_CONFIG_KEY = 'default';
const DEFAULT_CONFIG: Partial<Configuration> = {
  key: DEFAULT_CONFIG_KEY,
  llmProvider: LLMProvider.OPENAI,
  model: 'gpt-4o',
  temperature: 0.1,
  maxTokens: 1200,
  topP: 1,
  topK: null,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: null,
};

let cachedConfig: Configuration | null = null;
let cachedAtMs = 0;

const getCacheTtlMs = (): number => {
  const v = Number(process.env.AI_CONFIG_CACHE_MS || 5000);
  return Number.isFinite(v) && v >= 0 ? v : 5000;
};

export const invalidateDefaultAIConfigCache = () => {
  cachedConfig = null;
  cachedAtMs = 0;
};

export const getDefaultAIConfig = async (): Promise<Configuration> => {
  const ttl = getCacheTtlMs();
  const now = Date.now();
  if (cachedConfig && now - cachedAtMs <= ttl) return cachedConfig;

  let config = await configRepository.findOne({ where: { key: DEFAULT_CONFIG_KEY } });
  if (!config) {
    config = configRepository.create(DEFAULT_CONFIG);
    config = await configRepository.save(config);
  }

  cachedConfig = config;
  cachedAtMs = now;
  return config;
};
