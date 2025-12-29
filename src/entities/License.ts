import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { User } from './User'
import { KnowledgeBase } from './KnowledgeBase'

@Entity()
export class License {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  key!: string

  @Column({ default: true })
  isActive!: boolean

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null

  @OneToOne(() => User, user => user.license, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @ManyToMany(() => KnowledgeBase, kb => kb.licenses)
  @JoinTable()
  knowledgeBases!: KnowledgeBase[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
