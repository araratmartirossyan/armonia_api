import fs from 'fs'
import { Request, Response } from 'express'

import { ragService } from '../../services/ragService'
import { isLicenseValid } from '../licenseController'
import { UploadedDocumentSummary, UploadError } from '../../types/kb'
import { getPdfParse, resolveExistingPdfPath } from './kbDocumentUtils'
import { documentRepository, kbRepository, licenseRepository } from './kbRepositories'

export const uploadPDF = async (req: Request, res: Response) => {
  const { id: kbId } = req.params
  const files = req.files as Express.Multer.File[]

  if (!files || files.length === 0) {
    return res.status(400).json({ message: 'No PDF files uploaded' })
  }

  if (!kbId) {
    files.forEach(file => {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path)
    })
    return res.status(400).json({ message: 'Knowledge base ID is required' })
  }

  try {
    const kb = await kbRepository.findOne({ where: { id: kbId } })
    if (!kb) {
      files.forEach(file => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
      })
      return res.status(404).json({ message: 'Knowledge base not found' })
    }

    const uploadedDocuments: UploadedDocumentSummary[] = []
    const errors: UploadError[] = []

    for (const file of files) {
      try {
        const dataBuffer = fs.readFileSync(file.path)
        const PDFParseClass = await getPdfParse()
        const parser = new PDFParseClass({ data: dataBuffer })
        const result = await parser.getText()
        const textContent = result.text
        const pageCount = result.pages?.length || 0

        if (!textContent || textContent.trim().length === 0) {
          fs.unlinkSync(file.path)
          errors.push({
            fileName: file.originalname,
            error: 'PDF file appears to be empty or contains no extractable text',
          })
          continue
        }

        const document = documentRepository.create({
          fileName: file.originalname,
          filePath: file.path,
          knowledgeBaseId: kbId,
          metadata: {
            fileSize: file.size,
            pageCount: pageCount,
            uploadedAt: new Date().toISOString(),
          },
        })

        await documentRepository.save(document)

        await ragService.ingestDocument(kbId, textContent, {
          fileName: file.originalname,
          documentId: document.id,
          pageCount: pageCount,
          sourceUrl: `/knowledge-bases/${kbId}/documents/${document.id}/file`,
        })

        uploadedDocuments.push({
          id: document.id,
          fileName: document.fileName,
          pageCount: pageCount,
          createdAt: document.createdAt,
        })
      } catch (error: unknown) {
        console.error(`Error processing file ${file.originalname}:`, error)
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
        errors.push({
          fileName: file.originalname,
          error: error instanceof Error ? error.message : 'Unknown error processing file',
        })
      }
    }

    if (uploadedDocuments.length === 0) {
      return res.status(400).json({ message: 'No files were successfully uploaded', errors })
    }

    return res.status(201).json({
      message: `${uploadedDocuments.length} PDF file(s) uploaded and ingested successfully`,
      documents: uploadedDocuments,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    console.error('Error uploading PDFs:', error)
    files.forEach(file => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
    })
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ message: 'Error uploading PDFs: ' + msg })
  }
}

export const deleteKnowledgeBaseDocument = async (req: Request, res: Response) => {
  const { id: kbId, documentId } = req.params

  try {
    const doc = await documentRepository.findOne({
      where: { id: documentId, knowledgeBaseId: kbId },
    })
    if (!doc) {
      return res.status(404).json({ message: 'Document not found in this knowledge base' })
    }

    await ragService.deleteDocument(kbId, documentId)

    if (doc.filePath && fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath)
      } catch (error) {
        console.error(`Error deleting file ${doc.filePath}:`, error)
      }
    }

    await documentRepository.remove(doc)
    return res.json({ message: 'Document deleted successfully', documentId })
  } catch (error) {
    console.error('Error deleting knowledge base document:', error)
    return res.status(500).json({ message: 'Error deleting document' })
  }
}

export const reindexKnowledgeBase = async (req: Request, res: Response) => {
  const { id: kbId } = req.params

  try {
    const kb = await kbRepository.findOne({ where: { id: kbId } })
    if (!kb) return res.status(404).json({ message: 'Knowledge base not found' })

    const documents = await documentRepository.find({ where: { knowledgeBaseId: kbId } })
    if (documents.length === 0)
      return res.status(400).json({ message: 'No documents found for this knowledge base' })

    await ragService.deleteKnowledgeBase(kbId)

    const errors: Array<{ documentId: string; fileName: string; error: string }> = []
    let reindexed = 0

    for (const doc of documents) {
      try {
        const pdfPath = resolveExistingPdfPath(doc)
        if (!pdfPath) {
          errors.push({
            documentId: doc.id,
            fileName: doc.fileName,
            error: 'File not found on disk',
          })
          continue
        }

        const dataBuffer = fs.readFileSync(pdfPath)
        const PDFParseClass = await getPdfParse()
        const parser = new PDFParseClass({ data: dataBuffer })
        const result = await parser.getText()
        const textContent = result?.text || ''
        const pageCount = result?.pages?.length || 0

        if (!textContent || textContent.trim().length === 0) {
          errors.push({
            documentId: doc.id,
            fileName: doc.fileName,
            error: 'No extractable text found in PDF (might be scanned/image-only PDF)',
          })
          continue
        }

        await ragService.ingestDocument(kbId, textContent, {
          fileName: doc.fileName,
          documentId: doc.id,
          pageCount,
          sourceUrl: `/knowledge-bases/${kbId}/documents/${doc.id}/file`,
        })

        reindexed++
      } catch (e: unknown) {
        errors.push({
          documentId: doc.id,
          fileName: doc.fileName,
          error: e instanceof Error ? e.message : 'Unknown error',
        })
      }
    }

    return res.json({
      message: 'Knowledge base reindex completed',
      kbId,
      totalDocuments: documents.length,
      reindexedDocuments: reindexed,
      failedDocuments: errors.length,
      errors: errors.length ? errors : undefined,
    })
  } catch (error) {
    console.error('Error reindexing knowledge base:', error)
    return res.status(500).json({ message: 'Error reindexing knowledge base' })
  }
}

export const downloadKnowledgeBaseDocument = async (req: Request, res: Response) => {
  const { id: kbId, documentId } = req.params
  const user = req.user
  if (!user) return res.status(401).json({ message: 'Unauthorized' })

  try {
    const doc = await documentRepository.findOne({
      where: { id: documentId, knowledgeBaseId: kbId },
    })
    if (!doc) return res.status(404).json({ message: 'Document not found in this knowledge base' })

    if (user.role !== 'ADMIN') {
      const license = await licenseRepository
        .createQueryBuilder('license')
        .leftJoinAndSelect('license.user', 'user')
        .leftJoinAndSelect('license.knowledgeBases', 'knowledgeBases')
        .where('user.id = :userId', { userId: user.userId })
        .getOne()
      if (!license || !isLicenseValid(license))
        return res.status(403).json({ message: 'License is not valid' })
      const hasKb =
        Array.isArray(license.knowledgeBases) && license.knowledgeBases.some(kb => kb.id === kbId)
      if (!hasKb)
        return res.status(403).json({ message: 'Knowledge base not attached to this license' })
    }

    const pdfPath = resolveExistingPdfPath(doc)
    if (!pdfPath) return res.status(404).json({ message: 'File not found on disk' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`)
    return fs.createReadStream(pdfPath).pipe(res)
  } catch (error) {
    console.error('Error downloading knowledge base document:', error)
    return res.status(500).json({ message: 'Error downloading document' })
  }
}
