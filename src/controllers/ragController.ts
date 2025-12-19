import { Request, Response } from 'express';
import { ragService } from '../services/ragService';
import { AppDataSource } from '../data-source';
import { License } from '../entities/License';
import { KnowledgeBase } from '../entities/KnowledgeBase';
import { isLicenseValid } from './licenseController';

const licenseRepository = AppDataSource.getRepository(License);
const kbRepository = AppDataSource.getRepository(KnowledgeBase);

export const chat = async (req: Request, res: Response) => {
  const { question, licenseKey, kbId, history } = req.body;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Verify license belongs to user or user is admin
    const license = await licenseRepository.findOne({
      where: { key: licenseKey },
      relations: ['user', 'knowledgeBases'],
    });

    if (!license) {
      return res.status(404).json({ message: 'License not found' });
    }
    // Check ownership
    if (license.user.id !== user.userId) {
      return res.status(403).json({ message: 'Forbidden access to this license' });
    }

    // Check if license is valid (active and not expired)
    if (!isLicenseValid(license)) {
      if (!license.isActive) {
        return res.status(403).json({ message: 'License is deactivated' });
      }
      if (license.expiresAt && new Date() > license.expiresAt) {
        return res.status(403).json({ message: 'License has expired' });
      }
    }

    // Get knowledge base (use specified one or first one)
    let knowledgeBase: KnowledgeBase | null = null;
    if (kbId) {
      knowledgeBase = await kbRepository.findOne({
        where: { id: kbId },
      });
      if (!knowledgeBase) {
        return res.status(404).json({ message: 'Knowledge base not found' });
      }
      // Verify KB is attached to license
      if (!license.knowledgeBases.some((kb) => kb.id === kbId)) {
        return res.status(403).json({ message: 'Knowledge base not attached to this license' });
      }
    } else if (license.knowledgeBases && license.knowledgeBases.length > 0) {
      // Use first knowledge base if none specified
      knowledgeBase = await kbRepository.findOne({
        where: { id: license.knowledgeBases[0].id },
      });
    }

    if (!knowledgeBase) {
      return res.status(400).json({ message: 'No knowledge base found for this license' });
    }

    // Query using kbId instead of licenseKey
    const answer = await ragService.query(
      knowledgeBase.id,
      question,
      knowledgeBase.promptInstructions,
      Array.isArray(history) ? history : undefined,
    );
    return res.json({ answer });
  } catch (error: any) {
    console.error(error);
    if (error.message && error.message.includes('API_KEY')) {
      return res.status(500).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Error processing query' });
  }
};

export const uploadDocument = async (req: Request, res: Response) => {
  // Mock upload for now. In real app, use multer to handle file upload
  // and then read file content.
  const { text, metadata, licenseKey, kbId } = req.body;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const license = await licenseRepository.findOne({
      where: { key: licenseKey },
      relations: ['user', 'knowledgeBases'],
    });

    if (!license) {
      return res.status(404).json({ message: 'License not found' });
    }

    // Check ownership
    if (user.role !== 'ADMIN' && license.user.id !== user.userId) {
      return res.status(403).json({ message: 'Forbidden access to this license' });
    }

    // Check if license is valid (active and not expired)
    if (!isLicenseValid(license)) {
      if (!license.isActive) {
        return res.status(403).json({ message: 'License is deactivated' });
      }
      if (license.expiresAt && new Date() > license.expiresAt) {
        return res.status(403).json({ message: 'License has expired' });
      }
    }

    // Get knowledge base
    if (!kbId) {
      return res.status(400).json({ message: 'kbId is required' });
    }

    const knowledgeBase = await kbRepository.findOne({
      where: { id: kbId },
    });

    if (!knowledgeBase) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }

    // Verify KB is attached to license
    if (!license.knowledgeBases.some((kb) => kb.id === kbId)) {
      return res.status(403).json({ message: 'Knowledge base not attached to this license' });
    }

    // Use kbId instead of licenseKey for RAG ingestion
    await ragService.ingestDocument(kbId, text, metadata);
    return res.status(200).json({ message: 'Document ingested successfully' });
  } catch (error: any) {
    console.error(error);
    if (error.message && error.message.includes('API_KEY')) {
      return res.status(500).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Error ingesting document' });
  }
};
