import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm'
import { LLMProvider } from './KnowledgeBase'

// Transformer to convert numeric strings to numbers
const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : parseFloat(value)),
}

@Entity()
export class Configuration {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true, default: 'default' })
  key!: string

  @Column({
    type: 'simple-enum',
    enum: LLMProvider,
    default: LLMProvider.OPENAI,
  })
  llmProvider!: LLMProvider

  @Column({ type: 'varchar', nullable: true })
  model!: string | null

  @Column('decimal', { nullable: true, precision: 3, scale: 2, transformer: numericTransformer })
  temperature!: number | null

  @Column('int', { nullable: true })
  maxTokens!: number | null

  @Column('decimal', { nullable: true, precision: 3, scale: 2, transformer: numericTransformer })
  topP!: number | null

  @Column('int', { nullable: true })
  topK!: number | null

  @Column('decimal', { nullable: true, precision: 3, scale: 2, transformer: numericTransformer })
  frequencyPenalty!: number | null

  @Column('decimal', { nullable: true, precision: 3, scale: 2, transformer: numericTransformer })
  presencePenalty!: number | null

  @Column('simple-array', { nullable: true })
  stopSequences!: string[] | null

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
