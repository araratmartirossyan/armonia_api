import { Request, Response } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../data-source'
import { Configuration } from '../entities/Configuration'
import { LLMProvider } from '../entities/KnowledgeBase'
import { invalidateDefaultAIConfigCache } from '../services/configService'

const configRepository = AppDataSource.getRepository(Configuration)

const DEFAULT_CONFIG_KEY = 'default'

const aiConfigSchema = z.object({
  model: z.string().trim().optional().nullable(),
  llmProvider: z.nativeEnum(LLMProvider).optional(),
  temperature: z.coerce
    .number()
    .min(0)
    .max(0.3) // clamp to safe RAG range to limit hallucinations
    .optional()
    .nullable(),
  maxTokens: z.coerce.number().int().positive().optional().nullable(),
  topP: z.coerce.number().min(0).max(1).optional().nullable(),
  topK: z.coerce.number().int().nonnegative().optional().nullable(),
  frequencyPenalty: z.coerce.number().min(-2).max(2).optional().nullable(),
  presencePenalty: z.coerce.number().min(-2).max(2).optional().nullable(),
  stopSequences: z.array(z.string()).optional().nullable(),
})

export const getAIConfig = async (req: Request, res: Response) => {
  try {
    let config = await configRepository.findOne({ where: { key: DEFAULT_CONFIG_KEY } })
    if (!config) {
      config = configRepository.create({ key: DEFAULT_CONFIG_KEY, llmProvider: LLMProvider.OPENAI })
      await configRepository.save(config)
    }
    return res.json(config)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error fetching AI configuration' })
  }
}

export const updateAIConfig = async (req: Request, res: Response) => {
  try {
    const parsed = aiConfigSchema.safeParse(req.body)
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid AI configuration', issues: parsed.error.format() })
    }

    let config = await configRepository.findOne({ where: { key: DEFAULT_CONFIG_KEY } })
    if (!config) {
      config = configRepository.create({ key: DEFAULT_CONFIG_KEY, llmProvider: LLMProvider.OPENAI })
    }

    Object.assign(config, parsed.data)
    await configRepository.save(config)
    invalidateDefaultAIConfigCache()
    return res.json(config)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error updating AI configuration' })
  }
}
