import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { LLMProvider } from '../entities/KnowledgeBase';
import { getDefaultAIConfig } from './configService';

let cachedKey: string | null = null;
let cachedLLM: BaseLanguageModel | null = null;

export class LLMProviderService {
  static async getLLM(): Promise<BaseLanguageModel> {
    const config = await getDefaultAIConfig();
    const provider = config.llmProvider || LLMProvider.OPENAI;

    const cacheKey = JSON.stringify({
      provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      topP: config.topP,
      topK: config.topK,
      frequencyPenalty: config.frequencyPenalty,
      presencePenalty: config.presencePenalty,
      stopSequences: config.stopSequences,
    });

    if (cachedKey === cacheKey && cachedLLM) return cachedLLM;
    switch (provider) {
      case LLMProvider.OPENAI: {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
        const model = config.model || 'gpt-4o';
        const isGpt5Family = /^gpt-5/i.test(model);

        type ChatOpenAIParams = ConstructorParameters<typeof ChatOpenAI>[0];
        const openAIParams: ChatOpenAIParams = {
          openAIApiKey: process.env.OPENAI_API_KEY,
          model,
        };

        if (!isGpt5Family && config.temperature !== null && config.temperature !== undefined) {
          openAIParams.temperature = config.temperature;
        }
        if (config.maxTokens !== null && config.maxTokens !== undefined) openAIParams.maxTokens = config.maxTokens;
        if (config.topP !== null && config.topP !== undefined) openAIParams.topP = config.topP;
        if (config.frequencyPenalty !== null && config.frequencyPenalty !== undefined)
          openAIParams.frequencyPenalty = config.frequencyPenalty;
        if (config.presencePenalty !== null && config.presencePenalty !== undefined)
          openAIParams.presencePenalty = config.presencePenalty;
        if (config.stopSequences) openAIParams.stop = config.stopSequences;
        const llm = new ChatOpenAI(openAIParams);
        cachedKey = cacheKey;
        cachedLLM = llm;
        return llm;
      }

      case LLMProvider.GEMINI: {
        if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
        const geminiConfig = {
          model: config.model || 'gemini-pro',
          apiKey: process.env.GEMINI_API_KEY,
          temperature: config.temperature ?? 1.0,
          maxOutputTokens: config.maxTokens ?? 1200,
          topP: config.topP ?? 1.0,
          topK: config.topK ?? 0.0,
          stopSequences: config.stopSequences ?? undefined,
        };
        const llm = new ChatGoogleGenerativeAI(geminiConfig);
        cachedKey = cacheKey;
        cachedLLM = llm;
        return llm;
      }

      case LLMProvider.ANTHROPIC: {
        if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
        const anthropicConfig = {
          model: config.model || 'claude-3-sonnet-20240229',
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          temperature: config.temperature ?? 1.0,
          maxTokens: config.maxTokens ?? 1200,
          topP: config.topP ?? 1.0,
          topK: config.topK ?? 0.0,
          stopSequences: config.stopSequences ?? undefined,
        };
        const llm = new ChatAnthropic(anthropicConfig) as BaseLanguageModel;
        cachedKey = cacheKey;
        cachedLLM = llm;
        return llm;
      }

      default: {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
        const llm = new ChatOpenAI({ model: 'gpt-4o', openAIApiKey: process.env.OPENAI_API_KEY });
        cachedKey = cacheKey;
        cachedLLM = llm;
        return llm;
      }
    }
  }
}
