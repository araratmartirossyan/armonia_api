import { AppDataSource } from '../../data-source'
import { KnowledgeBase } from '../../entities/KnowledgeBase'
import { License } from '../../entities/License'
import { Document } from '../../entities/Document'

export const kbRepository = AppDataSource.getRepository(KnowledgeBase)
export const licenseRepository = AppDataSource.getRepository(License)
export const documentRepository = AppDataSource.getRepository(Document)
