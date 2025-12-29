import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { KnowledgeBase } from './KnowledgeBase'
import type { JsonObject } from '../types/json'

@Entity()
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  fileName!: string

  @Column()
  filePath!: string // Path to stored PDF file

  @Column('simple-json', { nullable: true })
  metadata!: JsonObject | null // Additional metadata (file size, page count, etc.)

  @ManyToOne(() => KnowledgeBase, kb => kb.documents, { onDelete: 'CASCADE' })
  knowledgeBase!: KnowledgeBase

  @Column()
  knowledgeBaseId!: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
