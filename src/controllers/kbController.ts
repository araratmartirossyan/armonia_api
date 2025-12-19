import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { KnowledgeBase } from '../entities/KnowledgeBase';
import { License } from '../entities/License';
import { Document } from '../entities/Document';
import fs from 'fs';
import path from 'path';
import { ragService } from '../services/ragService';
import { isLicenseValid } from './licenseController';

// Lazy load pdf-parse only when needed to avoid memory issues at startup
let PDFParse: any = null;
const getPdfParse = () => {
  if (!PDFParse) {
    const pdfParseModule = require('pdf-parse');
    PDFParse = pdfParseModule.PDFParse;
  }
  return PDFParse;
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

export const updateKnowledgeBase = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, promptInstructions } = req.body;

  try {
    const kb = await kbRepository.findOne({
      where: { id },
      relations: ['licenses', 'pdfDocuments'],
    });

    if (!kb) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }

    // Update only provided fields
    if (name !== undefined) {
      kb.name = name;
    }
    if (description !== undefined) {
      kb.description = description;
    }
    if (promptInstructions !== undefined) {
      kb.promptInstructions = promptInstructions || null;
    }

    await kbRepository.save(kb);

    // Reload with relations
    const updatedKb = await kbRepository.findOne({
      where: { id },
      relations: ['licenses', 'pdfDocuments'],
    });

    return res.json(updatedKb);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating knowledge base' });
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
  const files = req.files as Express.Multer.File[];

  console.log('[uploadPDF] start', { kbId, fileCount: files?.length || 0 });

  if (!files || files.length === 0) {
    console.log('[uploadPDF] no files provided');
    return res.status(400).json({ message: 'No PDF files uploaded' });
  }

  if (!kbId) {
    // Clean up uploaded files if kbId is missing
    files.forEach((file) => {
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
    return res.status(400).json({ message: 'Knowledge base ID is required' });
  }

  try {
    // Verify knowledge base exists
    const kb = await kbRepository.findOne({
      where: { id: kbId },
    });

    if (!kb) {
      console.log('[uploadPDF] kb not found', { kbId });
      // Clean up all uploaded files
      files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      return res.status(404).json({ message: 'Knowledge base not found' });
    }

    const uploadedDocuments = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      try {
        console.log('[uploadPDF] processing file', { kbId, fileName: file.originalname, size: file.size });
        // Read and parse PDF (lazy load pdf-parse to avoid memory issues at startup)
        const dataBuffer = fs.readFileSync(file.path);
        console.log('[uploadPDF] dataBuffer length', dataBuffer.length);
        const PDFParseClass = getPdfParse();
        console.log('[uploadPDF] parsing pdf', { kbId, fileName: file.originalname });
        const parser = new PDFParseClass({ data: dataBuffer });
        const result = await parser.getText();
        console.log('[uploadPDF] parsed pdf', {
          kbId,
          fileName: file.originalname,
          hasText: !!result?.text,
          pages: result?.pages?.length,
        });
        const textContent = result.text;
        const pageCount = result.pages?.length || 0;

        if (!textContent || textContent.trim().length === 0) {
          fs.unlinkSync(file.path);
          errors.push({
            fileName: file.originalname,
            error: 'PDF file appears to be empty or contains no extractable text',
          });
          continue;
        }

        // Save document metadata to database
        const document = documentRepository.create({
          fileName: file.originalname,
          filePath: file.path,
          knowledgeBaseId: kbId,
          metadata: {
            fileSize: file.size,
            pageCount: pageCount,
            uploadedAt: new Date().toISOString(),
          },
        });

        await documentRepository.save(document);

        // Ingest document text into RAG service (using kbId, not licenseKey)
        console.log('[uploadPDF] ingesting into rag', { kbId, fileName: file.originalname, documentId: document.id });
        await ragService.ingestDocument(kbId, textContent, {
          fileName: file.originalname,
          documentId: document.id,
          pageCount: pageCount,
          sourceUrl: `/knowledge-bases/${kbId}/documents/${document.id}/file`,
        });
        console.log('[uploadPDF] ingested into rag', { kbId, fileName: file.originalname, documentId: document.id });

        uploadedDocuments.push({
          id: document.id,
          fileName: document.fileName,
          pageCount: pageCount,
          createdAt: document.createdAt,
        });
        console.log('[uploadPDF] file processed', { kbId, fileName: file.originalname, documentId: document.id });
      } catch (error: any) {
        console.error(`Error processing file ${file.originalname}:`, error);
        // Clean up file on error
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        errors.push({
          fileName: file.originalname,
          error: error.message || 'Unknown error processing file',
        });
      }
    }

    // Return results
    if (uploadedDocuments.length === 0) {
      return res.status(400).json({
        message: 'No files were successfully uploaded',
        errors,
      });
    }

    console.log('[uploadPDF] completed', {
      kbId,
      uploadedCount: uploadedDocuments.length,
      errorCount: errors.length,
    });

    return res.status(201).json({
      message: `${uploadedDocuments.length} PDF file(s) uploaded and ingested successfully`,
      documents: uploadedDocuments,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error uploading PDFs:', error);
    // Clean up all uploaded files on error
    files.forEach((file) => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
    return res.status(500).json({ message: 'Error uploading PDFs: ' + (error.message || 'Unknown error') });
  }
};

export const deleteKnowledgeBase = async (req: Request, res: Response) => {
  const { id: kbId } = req.params;

  try {
    // Get knowledge base with relations
    const kb = await kbRepository.findOne({
      where: { id: kbId },
      relations: ['licenses', 'pdfDocuments'],
    });

    if (!kb) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }

    // Get all documents to delete their files
    const documents = await documentRepository.find({
      where: { knowledgeBaseId: kbId },
    });

    // Delete PDF files from filesystem
    documents.forEach((doc) => {
      if (fs.existsSync(doc.filePath)) {
        try {
          fs.unlinkSync(doc.filePath);
        } catch (error) {
          console.error(`Error deleting file ${doc.filePath}:`, error);
        }
      }
    });

    // Remove KB from all licenses (ManyToMany relationship)
    if (kb.licenses && kb.licenses.length > 0) {
      for (const license of kb.licenses) {
        const licenseWithKBs = await licenseRepository.findOne({
          where: { id: license.id },
          relations: ['knowledgeBases'],
        });
        if (licenseWithKBs) {
          licenseWithKBs.knowledgeBases = licenseWithKBs.knowledgeBases.filter((kb) => kb.id !== kbId);
          await licenseRepository.save(licenseWithKBs);
        }
      }
    }

    // Delete vector store for this KB
    await ragService.deleteKnowledgeBase(kbId);

    // Delete knowledge base (documents will be cascade deleted due to onDelete: 'CASCADE')
    await kbRepository.remove(kb);

    return res.json({
      message: 'Knowledge base deleted successfully',
      deletedDocuments: documents.length,
    });
  } catch (error) {
    console.error('Error deleting knowledge base:', error);
    return res.status(500).json({ message: 'Error deleting knowledge base' });
  }
};

export const deleteKnowledgeBaseDocument = async (req: Request, res: Response) => {
  const { id: kbId, documentId } = req.params;

  try {
    const doc = await documentRepository.findOne({
      where: { id: documentId, knowledgeBaseId: kbId },
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found in this knowledge base' });
    }

    // Delete vector chunks for this document (so RAG stops using it immediately)
    await ragService.deleteDocument(kbId, documentId);

    // Delete file from filesystem (best-effort)
    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch (error) {
        console.error(`Error deleting file ${doc.filePath}:`, error);
      }
    }

    // Delete DB row
    await documentRepository.remove(doc);

    return res.json({ message: 'Document deleted successfully', documentId });
  } catch (error) {
    console.error('Error deleting knowledge base document:', error);
    return res.status(500).json({ message: 'Error deleting document' });
  }
};

export const reindexKnowledgeBase = async (req: Request, res: Response) => {
  const { id: kbId } = req.params;

  try {
    const kb = await kbRepository.findOne({ where: { id: kbId } });
    if (!kb) {
      return res.status(404).json({ message: 'Knowledge base not found' });
    }

    const documents = await documentRepository.find({ where: { knowledgeBaseId: kbId } });
    if (documents.length === 0) {
      return res.status(400).json({ message: 'No documents found for this knowledge base' });
    }

    // Remove all vectors for this KB, then re-ingest from stored PDFs.
    await ragService.deleteKnowledgeBase(kbId);

    const errors: Array<{ documentId: string; fileName: string; error: string }> = [];
    let reindexed = 0;

    const getUploadsDir = (): string => {
      const configured = process.env.UPLOADS_DIR?.trim();
      if (configured) return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
      return path.join(process.cwd(), 'uploads');
    };

    const resolveExistingPdfPath = (doc: Document): string | null => {
      const uploadsDir = getUploadsDir();

      const candidates: string[] = [];
      if (doc.filePath) {
        candidates.push(path.isAbsolute(doc.filePath) ? doc.filePath : path.join(process.cwd(), doc.filePath));
      }
      if (doc.fileName) {
        candidates.push(path.join(uploadsDir, doc.fileName));
      }

      for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
      }

      // Fallback: if disk filename has UUID suffix, try to find by base name prefix in uploadsDir.
      // Example: "manual.pdf" might exist as "manual-<uuid>.pdf"
      try {
        const ext = path.extname(doc.fileName || '').toLowerCase() || '.pdf';
        const base = path.basename(doc.fileName || '', ext);
        if (!base) return null;
        const files = fs.readdirSync(uploadsDir);
        const matches = files
          .filter((f) => f.toLowerCase().endsWith(ext) && f.startsWith(`${base}-`))
          .map((f) => path.join(uploadsDir, f))
          .filter((p) => fs.existsSync(p));
        if (!matches.length) return null;
        // pick most recently modified match
        matches.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        return matches[0];
      } catch {
        return null;
      }
    };

    for (const doc of documents) {
      try {
        const pdfPath = resolveExistingPdfPath(doc);
        if (!pdfPath) {
          errors.push({
            documentId: doc.id,
            fileName: doc.fileName,
            error: 'File not found on disk',
          });
          continue;
        }

        const dataBuffer = fs.readFileSync(pdfPath);
        const PDFParseClass = getPdfParse();
        const parser = new PDFParseClass({ data: dataBuffer });
        const result = await parser.getText();
        const textContent = result?.text || '';
        const pageCount = result?.pages?.length || 0;

        if (!textContent || textContent.trim().length === 0) {
          errors.push({
            documentId: doc.id,
            fileName: doc.fileName,
            error: 'No extractable text found in PDF (might be scanned/image-only PDF)',
          });
          continue;
        }

        await ragService.ingestDocument(kbId, textContent, {
          fileName: doc.fileName,
          documentId: doc.id,
          pageCount,
          sourceUrl: `/knowledge-bases/${kbId}/documents/${doc.id}/file`,
        });

        reindexed++;
      } catch (e: any) {
        errors.push({
          documentId: doc.id,
          fileName: doc.fileName,
          error: e?.message || 'Unknown error',
        });
      }
    }

    return res.json({
      message: 'Knowledge base reindex completed',
      kbId,
      totalDocuments: documents.length,
      reindexedDocuments: reindexed,
      failedDocuments: errors.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error('Error reindexing knowledge base:', error);
    return res.status(500).json({ message: 'Error reindexing knowledge base' });
  }
};

export const downloadKnowledgeBaseDocument = async (req: Request, res: Response) => {
  const { id: kbId, documentId } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const doc = await documentRepository.findOne({
      where: { id: documentId, knowledgeBaseId: kbId },
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found in this knowledge base' });
    }

    // Access control:
    // - ADMIN can download any KB doc
    // - CUSTOMER must have a valid license that has this KB attached
    if (user.role !== 'ADMIN') {
      const license = await licenseRepository.findOne({
        where: { user: { id: user.userId } as any },
        relations: ['knowledgeBases', 'user'],
      });
      if (!license || !isLicenseValid(license)) {
        return res.status(403).json({ message: 'License is not valid' });
      }
      const hasKb = Array.isArray(license.knowledgeBases) && license.knowledgeBases.some((kb) => kb.id === kbId);
      if (!hasKb) {
        return res.status(403).json({ message: 'Knowledge base not attached to this license' });
      }
    }

    if (!doc.filePath || !fs.existsSync(doc.filePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    // Stream file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    return fs.createReadStream(doc.filePath).pipe(res);
  } catch (error) {
    console.error('Error downloading knowledge base document:', error);
    return res.status(500).json({ message: 'Error downloading document' });
  }
};
