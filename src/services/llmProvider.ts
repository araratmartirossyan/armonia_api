import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { LLMProvider } from '../entities/KnowledgeBase';
import { Configuration } from '../entities/Configuration';
import { AppDataSource } from '../data-source';

const configRepository = AppDataSource.getRepository(Configuration);
const DEFAULT_CONFIG_KEY = 'default';

/**
 * Get global AI configuration
 */
const getGlobalConfig = async (): Promise<Configuration> => {
  let config = await configRepository.findOne({ where: { key: DEFAULT_CONFIG_KEY } });
  if (!config) {
    // Create default config if it doesn't exist
    config = configRepository.create({
      key: DEFAULT_CONFIG_KEY,
      llmProvider: LLMProvider.OPENAI,
      // Strong defaults for RAG (can be changed via config endpoints)
      model: 'gpt-5',
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

export class LLMProviderService {
  static async getLLM(): Promise<BaseLanguageModel> {
    const config = await getGlobalConfig();
    const provider = config.llmProvider || LLMProvider.OPENAI;

    switch (provider) {
      case LLMProvider.OPENAI:
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is not set in environment variables');
        }
        const openAIConfig: any = {
          modelName: config.model || 'gpt-4o',
          openAIApiKey: process.env.OPENAI_API_KEY,
        };
        if (config.temperature !== null) openAIConfig.temperature = config.temperature;
        if (config.maxTokens !== null) openAIConfig.maxTokens = config.maxTokens;
        if (config.topP !== null) openAIConfig.topP = config.topP;
        if (config.frequencyPenalty !== null) openAIConfig.frequencyPenalty = config.frequencyPenalty;
        if (config.presencePenalty !== null) openAIConfig.presencePenalty = config.presencePenalty;
        return new ChatOpenAI(openAIConfig);

      case LLMProvider.GEMINI:
        if (!process.env.GEMINI_API_KEY) {
          throw new Error('GEMINI_API_KEY is not set in environment variables');
        }
        const geminiConfig: any = {
          model: config.model || 'gemini-pro',
          apiKey: process.env.GEMINI_API_KEY,
        };
        if (config.temperature !== null) geminiConfig.temperature = config.temperature;
        if (config.maxTokens !== null) geminiConfig.maxOutputTokens = config.maxTokens;
        if (config.topP !== null) geminiConfig.topP = config.topP;
        if (config.topK !== null) geminiConfig.topK = config.topK;
        if (config.stopSequences && config.stopSequences.length > 0) {
          geminiConfig.stopSequences = config.stopSequences;
        }
        return new ChatGoogleGenerativeAI(geminiConfig);

      case LLMProvider.ANTHROPIC:
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
        }
        const anthropicConfig: any = {
          model: config.model || 'claude-3-sonnet-20240229',
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        };
        if (config.temperature !== null) anthropicConfig.temperature = config.temperature;
        if (config.maxTokens !== null) anthropicConfig.maxTokens = config.maxTokens;
        if (config.topP !== null) anthropicConfig.topP = config.topP;
        if (config.topK !== null) anthropicConfig.topK = config.topK;
        if (config.stopSequences && config.stopSequences.length > 0) {
          anthropicConfig.stopSequences = config.stopSequences;
        }
        return new ChatAnthropic(anthropicConfig) as BaseLanguageModel;

      default:
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is not set in environment variables');
        }
        return new ChatOpenAI({
          modelName: config.model || 'gpt-4o',
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
    }
  }
}
