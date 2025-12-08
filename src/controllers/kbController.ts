import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { KnowledgeBase } from '../entities/KnowledgeBase';
import { License } from '../entities/License';
import { Document } from '../entities/Document';
import fs from 'fs';
import path from 'path';
import { ragService } from '../services/ragService';

// Lazy load pdf-parse only when needed to avoid memory issues at startup
let pdfParse: any = null;
const getPdfParse = () => {
  if (!pdfParse) {
    pdfParse = require('pdf-parse');
  }
  return pdfParse;
};

const kbRepository = AppDataSource.getRepository(KnowledgeBase);
const licenseRepository = AppDataSource.getRepository(License);
const documentRepository = AppDataSource.getRepository(Document);

export const createKnowledgeBase = async (req: Request, res: Response) => {
  const { name, description, documents, promptInstructions } = req.body;

  try {
    const kb = kbRepository.create({
      name,
      description,
      documents,
      promptInstructions: promptInstructions || null,
    });

    await kbRepository.save(kb);
    return res.status(201).json(kb);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error creating knowledge base' });
  }
};

export const getKnowledgeBase = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const kb = await kbRepository.findOne({
      where: { id },
      relations: ['licenses', 'pdfDocuments'],
    });

    if (!kb) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }

    return res.json(kb);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching knowledge base' });
  }
};

export const listKnowledgeBases = async (req: Request, res: Response) => {
  try {
    const kbs = await kbRepository.find();
    return res.json(kbs);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error listing knowledge bases' });
  }
};

export const attachToLicense = async (req: Request, res: Response) => {
  const { kbId, licenseId } = req.body;

  try {
    const kb = await kbRepository.findOneBy({ id: kbId });
    const license = await licenseRepository.findOne({
      where: { id: licenseId },
      relations: ['knowledgeBases'],
    });

    if (!kb || !license) {
      return res.status(404).json({ message: 'Knowledge Base or License not found' });
    }

    license.knowledgeBases.push(kb);
    await licenseRepository.save(license);

    return res.json({ message: 'Knowledge Base attached to License successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error attaching knowledge base' });
  }
};

export const uploadPDF = async (req: Request, res: Response) => {
  const { id: kbId } = req.params; // Get kbId from URL parameter
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: 'No PDF file uploaded' });
  }

  if (!kbId) {
    // Clean up uploaded file if kbId is missing
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(400).json({ message: 'Knowledge base ID is required' });
  }

  try {
    // Verify knowledge base exists
    const kb = await kbRepository.findOne({
      where: { id: kbId },
    });

    if (!kb) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Knowledge base not found' });
    }

    // Read and parse PDF (lazy load pdf-parse to avoid memory issues at startup)
    const dataBuffer = fs.readFileSync(file.path);
    const pdfParseFn = getPdfParse();
    const pdfData = await pdfParseFn(dataBuffer);
    const textContent = pdfData.text;

    if (!textContent || textContent.trim().length === 0) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: 'PDF file appears to be empty or contains no extractable text' });
    }

    // Save document metadata to database
    const document = documentRepository.create({
      fileName: file.originalname,
      filePath: file.path,
      knowledgeBaseId: kbId,
      metadata: {
        fileSize: file.size,
        pageCount: pdfData.numpages,
        uploadedAt: new Date().toISOString(),
      },
    });

    await documentRepository.save(document);

    // Ingest document text into RAG service (using kbId, not licenseKey)
    await ragService.ingestDocument(kbId, textContent, {
      fileName: file.originalname,
      documentId: document.id,
      pageCount: pdfData.numpages,
    });

    return res.status(201).json({
      message: 'PDF uploaded and ingested successfully',
      document: {
        id: document.id,
        fileName: document.fileName,
        pageCount: pdfData.numpages,
        createdAt: document.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error uploading PDF:', error);
    // Clean up uploaded file on error
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(500).json({ message: 'Error uploading PDF: ' + (error.message || 'Unknown error') });
  }
};
