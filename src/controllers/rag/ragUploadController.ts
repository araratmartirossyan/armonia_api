import { Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { KnowledgeBase } from '../../entities/KnowledgeBase';
import { License } from '../../entities/License';
import { ragService } from '../../services/ragService';
import { isLicenseValid } from '../licenseController';

const licenseRepository = AppDataSource.getRepository(License);
const kbRepository = AppDataSource.getRepository(KnowledgeBase);

export const uploadDocument = async (req: Request, res: Response) => {
  const { text, metadata, licenseKey, kbId } = req.body;
  const user = req.user;

  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const license = await licenseRepository.findOne({
      where: { key: licenseKey },
      relations: ['user', 'knowledgeBases'],
    });

    if (!license) return res.status(404).json({ message: 'License not found' });
    if (user.role !== 'ADMIN' && license.user.id !== user.userId) {
      return res.status(403).json({ message: 'Forbidden access to this license' });
    }

    if (!isLicenseValid(license)) {
      if (!license.isActive) return res.status(403).json({ message: 'License is deactivated' });
      if (license.expiresAt && new Date() > license.expiresAt)
        return res.status(403).json({ message: 'License has expired' });
    }

    if (!kbId) return res.status(400).json({ message: 'kbId is required' });

    const knowledgeBase = await kbRepository.findOne({ where: { id: kbId } });
    if (!knowledgeBase) return res.status(404).json({ message: 'Knowledge base not found' });

    if (!license.knowledgeBases.some((kb) => kb.id === kbId)) {
      return res.status(403).json({ message: 'Knowledge base not attached to this license' });
    }

    await ragService.ingestDocument(kbId, text, metadata);
    return res.status(200).json({ message: 'Document ingested successfully' });
  } catch (error: unknown) {
    console.error(error);
    if (error instanceof Error && error.message.includes('API_KEY'))
      return res.status(500).json({ message: error.message });
    return res.status(500).json({ message: 'Error ingesting document' });
  }
};
