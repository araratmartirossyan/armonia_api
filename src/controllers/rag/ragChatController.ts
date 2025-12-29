import { Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { KnowledgeBase } from '../../entities/KnowledgeBase';
import { License } from '../../entities/License';
import { ragService } from '../../services/ragService';
import { GLOBAL_FALLBACK_PROMPT_INSTRUCTIONS } from '../../services/rag/globalPrompt';
import { isLicenseValid } from '../licenseController';

const licenseRepository = AppDataSource.getRepository(License);
const kbRepository = AppDataSource.getRepository(KnowledgeBase);

export const chat = async (req: Request, res: Response) => {
  const { question, licenseKey, kbId, history } = req.body;
  const user = req.user;

  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const license = await licenseRepository.findOne({
      where: { key: licenseKey },
      relations: ['user', 'knowledgeBases'],
    });

    if (!license) return res.status(404).json({ message: 'License not found' });
    if (license.user.id !== user.userId) return res.status(403).json({ message: 'Forbidden access to this license' });

    if (!isLicenseValid(license)) {
      if (!license.isActive) return res.status(403).json({ message: 'License is deactivated' });
      if (license.expiresAt && new Date() > license.expiresAt)
        return res.status(403).json({ message: 'License has expired' });
    }

    let knowledgeBase: KnowledgeBase | null = null;

    if (kbId) {
      knowledgeBase = await kbRepository.findOne({ where: { id: kbId } });
      if (!knowledgeBase) return res.status(404).json({ message: 'Knowledge base not found' });
      if (!license.knowledgeBases.some((kb) => kb.id === kbId)) {
        return res.status(403).json({ message: 'Knowledge base not attached to this license' });
      }
    }

    // If no specific kbId was requested, support multi-KB retrieval across ALL attached KBs.
    if (!kbId && Array.isArray(license.knowledgeBases) && license.knowledgeBases.length > 0) {
      const attachedKbIds = license.knowledgeBases.map((k) => k.id);
      const mergedInstructions = license.knowledgeBases
        .map((kb) => kb.promptInstructions)
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .join('\n\n---\n\n');

      const answer = await ragService.queryAcrossKnowledgeBases(
        attachedKbIds,
        question,
        mergedInstructions || null,
        Array.isArray(history) ? history : undefined,
      );
      return res.json({ answer });
    }

    if (!knowledgeBase) {
      const answer = await ragService.queryGlobal(
        question,
        GLOBAL_FALLBACK_PROMPT_INSTRUCTIONS,
        Array.isArray(history) ? history : undefined,
      );
      return res.json({ answer });
    }

    const answer = await ragService.query(
      knowledgeBase.id,
      question,
      knowledgeBase.promptInstructions,
      Array.isArray(history) ? history : undefined,
    );
    return res.json({ answer });
  } catch (error: unknown) {
    console.error(error);
    if (error instanceof Error && error.message.includes('API_KEY'))
      return res.status(500).json({ message: error.message });
    return res.status(500).json({ message: 'Error processing query' });
  }
};
