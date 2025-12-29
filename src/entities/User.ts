import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'
import { License } from './License'

export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
}

export enum CustomerStatus {
  ACTIVATION_REQUEST = 'Activation Request',
  IN_PROGRESS = 'In Progress',
  IN_TEST = 'In Test',
  ACTIVE = 'Active',
  UNPAID = 'Unpaid',
  TERMINATED = 'Terminated',
  TERMINATED_BL = 'Terminated - Blacklist',
  DEMO = 'Demo',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  email!: string

  @Column()
  password!: string

  @Column({
    type: 'simple-enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role!: UserRole

  @Column({ type: 'varchar', nullable: true })
  legalName!: string | null

  @Column({ type: 'varchar', nullable: true })
  centerName!: string | null

  @Column({
    type: 'simple-enum',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVATION_REQUEST,
  })
  customerStatus!: CustomerStatus

  @Column({ type: 'varchar', nullable: true })
  contactPerson!: string | null

  @Column({ type: 'varchar', nullable: true })
  contactNumber!: string | null

  @Column({ type: 'varchar', nullable: true })
  address!: string | null

  @Column({ type: 'varchar', nullable: true })
  assignedAgentFullName!: string | null

  @OneToOne(() => License, license => license.user)
  license!: License | null

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
