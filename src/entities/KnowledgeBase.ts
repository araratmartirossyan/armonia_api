import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { License } from './License'
import { Document } from './Document'
import type { JsonObject } from '../types/json'

export enum LLMProvider {
  OPENAI = 'OPENAI',
  GEMINI = 'GEMINI',
  ANTHROPIC = 'ANTHROPIC',
}

@Entity()
export class KnowledgeBase {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  name!: string

  @Column({ nullable: true })
  description!: string

  @Column('simple-json', { nullable: true })
  documents!: JsonObject | null // Deprecated: Use Document entity instead

  @Column('text', { nullable: true })
  promptInstructions!: string | null // Custom prompt instructions for this knowledge base

  @OneToMany(() => Document, document => document.knowledgeBase)
  pdfDocuments!: Document[]

  @ManyToMany(() => License, license => license.knowledgeBases)
  licenses!: License[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
