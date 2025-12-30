import fs from 'fs'
import { Request, Response } from 'express'

import { ragService } from '../../services/ragService'
import { KBOrder } from '../../types/kb'
import { buildMeta, parsePaginationQuery, pickSort } from '../../utils/pagination'
import { kbRepository, documentRepository, licenseRepository } from './kbRepositories'

export const createKnowledgeBase = async (req: Request, res: Response) => {
  const { name, description, documents, promptInstructions } = req.body

  try {
    const kb = kbRepository.create({
      name,
      description,
      documents,
      promptInstructions: promptInstructions || null,
    })

    await kbRepository.save(kb)
    return res.status(201).json(kb)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error creating knowledge base' })
  }
}

export const getKnowledgeBase = async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const kb = await kbRepository.findOne({
      where: { id },
      relations: ['licenses', 'pdfDocuments'],
    })

    if (!kb) {
      return res.status(404).json({ message: 'Knowledge base not found' })
    }

    return res.json(kb)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error fetching knowledge base' })
  }
}

export const updateKnowledgeBase = async (req: Request, res: Response) => {
  const { id } = req.params
  const { name, description, promptInstructions } = req.body

  try {
    const kb = await kbRepository.findOne({
      where: { id },
      relations: ['licenses', 'pdfDocuments'],
    })

    if (!kb) {
      return res.status(404).json({ message: 'Knowledge base not found' })
    }

    if (name !== undefined) kb.name = name
    if (description !== undefined) kb.description = description
    if (promptInstructions !== undefined) kb.promptInstructions = promptInstructions || null

    await kbRepository.save(kb)

    const updatedKb = await kbRepository.findOne({
      where: { id },
      relations: ['licenses', 'pdfDocuments'],
    })

    return res.json(updatedKb)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error updating knowledge base' })
  }
}

export const listKnowledgeBases = async (req: Request, res: Response) => {
  try {
    const parsed = parsePaginationQuery(req.query, { defaultSortDir: 'DESC' })
    if (!parsed.ok) {
      return res
        .status(400)
        .json({ message: 'Invalid pagination params', issues: parsed.error.format() })
    }

    const { sortBy, sortDir } = pickSort(
      parsed.sortBy,
      parsed.sortDir,
      ['createdAt', 'updatedAt', 'name'] as const,
      'createdAt',
    )

    // Avoid TypeORM's deep recursive FindOptionsOrder<> generic (can trigger TS2589).
    const order: KBOrder = { [sortBy]: sortDir }
    const [items, totalItems] = await kbRepository.findAndCount({
      skip: parsed.skip,
      take: parsed.take,
      order,
    })

    return res.json({
      items,
      meta: buildMeta({
        page: parsed.page,
        pageSize: parsed.pageSize,
        totalItems,
        sortBy,
        sortDir,
      }),
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error listing knowledge bases' })
  }
}

export const attachToLicense = async (req: Request, res: Response) => {
  const { kbId, licenseId } = req.body

  try {
    const kb = await kbRepository.findOneBy({ id: kbId })
    const license = await licenseRepository.findOne({
      where: { id: licenseId },
      relations: ['knowledgeBases'],
    })

    if (!kb || !license) {
      return res.status(404).json({ message: 'Knowledge Base or License not found' })
    }

    license.knowledgeBases.push(kb)
    await licenseRepository.save(license)

    return res.json({ message: 'Knowledge Base attached to License successfully' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error attaching knowledge base' })
  }
}

export const deleteKnowledgeBase = async (req: Request, res: Response) => {
  const { id: kbId } = req.params

  try {
    const kb = await kbRepository.findOne({
      where: { id: kbId },
      relations: ['licenses', 'pdfDocuments'],
    })

    if (!kb) {
      return res.status(404).json({ message: 'Knowledge base not found' })
    }

    const documents = await documentRepository.find({ where: { knowledgeBaseId: kbId } })

    documents.forEach(doc => {
      if (doc.filePath && fs.existsSync(doc.filePath)) {
        try {
          fs.unlinkSync(doc.filePath)
        } catch (error) {
          console.error(`Error deleting file ${doc.filePath}:`, error)
        }
      }
    })

    if (kb.licenses && kb.licenses.length > 0) {
      for (const license of kb.licenses) {
        const licenseWithKBs = await licenseRepository.findOne({
          where: { id: license.id },
          relations: ['knowledgeBases'],
        })
        if (licenseWithKBs) {
          licenseWithKBs.knowledgeBases = licenseWithKBs.knowledgeBases.filter(x => x.id !== kbId)
          await licenseRepository.save(licenseWithKBs)
        }
      }
    }

    await ragService.deleteKnowledgeBase(kbId)
    await kbRepository.remove(kb)

    return res.json({
      message: 'Knowledge base deleted successfully',
      deletedDocuments: documents.length,
    })
  } catch (error) {
    console.error('Error deleting knowledge base:', error)
    return res.status(500).json({ message: 'Error deleting knowledge base' })
  }
}
