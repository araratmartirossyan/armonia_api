import bcrypt from 'bcryptjs'
import { Request, Response } from 'express'

import { AppDataSource } from '../data-source'
import { CustomerStatus, User, UserRole } from '../entities/User'
import { signToken } from '../utils/jwt'
import { sanitizeUser } from '../utils/userUtils'

const userRepository = AppDataSource.getRepository(User)

export const register = async (req: Request, res: Response) => {
  const {
    email,
    password,
    role,
    legalName,
    centerName,
    customerStatus,
    contactPerson,
    contactNumber,
    address,
    assignedAgentFullName,
  } = req.body

  try {
    const existingUser = await userRepository.findOneBy({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = userRepository.create({
      email,
      password: hashedPassword,
      role: role || UserRole.CUSTOMER,
      legalName: legalName ?? null,
      centerName: centerName ?? null,
      customerStatus: customerStatus ?? CustomerStatus.ACTIVATION_REQUEST,
      contactPerson: contactPerson ?? null,
      contactNumber: contactNumber ?? null,
      address: address ?? null,
      assignedAgentFullName: assignedAgentFullName ?? null,
    })

    await userRepository.save(user)

    const savedUser = await userRepository.findOne({
      where: { id: user.id },
      relations: ['license'],
    })

    const token = signToken({ userId: user.id, role: user.role })
    return res.status(201).json({
      token,
      user: savedUser ? sanitizeUser(savedUser) : sanitizeUser(user),
      license: null,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

export const login = async ({ body: { email, password } }: Request, res: Response) => {
  try {
    const user = await userRepository.findOne({
      where: { email },
      relations: ['license'],
    })

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = signToken({ userId: user.id, role: user.role })
    return res.json({
      token,
      user: sanitizeUser(user),
      license: user.license?.key ?? null,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
