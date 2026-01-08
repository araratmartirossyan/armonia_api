import { Request, Response } from 'express'
import type { FindOptionsOrder } from 'typeorm'
import bcrypt from 'bcryptjs'

import { AppDataSource } from '../data-source'
import { License } from '../entities/License'
import { CustomerStatus, User } from '../entities/User'
import { buildMeta, parsePaginationQuery, pickSort } from '../utils/pagination'
import { sanitizeUser } from '../utils/userUtils'
import { isLicenseValid } from './licenseController'

const userRepository = AppDataSource.getRepository(User)
const licenseRepository = AppDataSource.getRepository(License)

export const listUsers = async (req: Request, res: Response) => {
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
      ['createdAt', 'updatedAt', 'email', 'role', 'customerStatus'] as const,
      'createdAt',
    )

    const order = { [sortBy]: sortDir } as FindOptionsOrder<User>
    const [users, totalItems] = await userRepository.findAndCount({
      relations: ['license'],
      skip: parsed.skip,
      take: parsed.take,
      order,
    })

    // Sanitize all users (remove passwords)
    const sanitizedUsers = users.map(user => sanitizeUser(user))

    return res.json({
      items: sanitizedUsers,
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
    return res.status(500).json({ message: 'Error listing users' })
  }
}

export const getMe = async (req: Request, res: Response) => {
  const currentUser = req.user
  if (!currentUser?.userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  try {
    const user = await userRepository.findOne({ where: { id: currentUser.userId } })
    if (!user) return res.status(404).json({ message: 'User not found' })

    const license = await licenseRepository
      .createQueryBuilder('license')
      .leftJoinAndSelect('license.user', 'user')
      .leftJoinAndSelect('license.knowledgeBases', 'knowledgeBases')
      .where('user.id = :userId', { userId: user.id })
      .getOne()

    return res.json({
      user: sanitizeUser(user),
      license: license
        ? {
            ...license,
            user: sanitizeUser(license.user),
            isValid: isLicenseValid(license),
          }
        : null,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error fetching current user' })
  }
}

export const getUser = async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const user = await userRepository.findOne({
      where: { id },
      relations: ['license'],
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json(sanitizeUser(user))
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error fetching user' })
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params
  const currentUser = req.user

  try {
    // Prevent self-deletion
    if (currentUser && currentUser.userId === id) {
      return res.status(400).json({ message: 'You cannot delete your own account' })
    }

    const user = await userRepository.findOne({
      where: { id },
      relations: ['license'],
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Check if user has a license
    if (user.license) {
      return res.status(400).json({
        message: 'Cannot delete user with an active license. Please delete the license first.',
        licenseId: user.license.id,
      })
    }

    await userRepository.remove(user)

    return res.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error deleting user' })
  }
}

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params
  const {
    legalName,
    centerName,
    customerStatus,
    contactPerson,
    contactNumber,
    address,
    assignedAgentFullName,
  } = req.body

  try {
    const user = await userRepository.findOne({
      where: { id },
      relations: ['license'],
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (legalName !== undefined) user.legalName = legalName ?? null
    if (centerName !== undefined) user.centerName = centerName ?? null
    if (customerStatus !== undefined)
      user.customerStatus = customerStatus ?? CustomerStatus.ACTIVATION_REQUEST
    if (contactPerson !== undefined) user.contactPerson = contactPerson ?? null
    if (contactNumber !== undefined) user.contactNumber = contactNumber ?? null
    if (address !== undefined) user.address = address ?? null
    if (assignedAgentFullName !== undefined)
      user.assignedAgentFullName = assignedAgentFullName ?? null

    await userRepository.save(user)

    const updated = await userRepository.findOne({
      where: { id },
      relations: ['license'],
    })

    return res.json(updated ? sanitizeUser(updated) : sanitizeUser(user))
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error updating user' })
  }
}

export const updateUserPassword = async (req: Request, res: Response) => {
  const { id } = req.params
  const { newPassword } = req.body

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' })
  }

  try {
    const user = await userRepository.findOne({ where: { id } })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const salt = await bcrypt.genSalt(10)
    user.password = await bcrypt.hash(newPassword, salt)

    await userRepository.save(user)

    return res.json({ message: 'User password updated successfully' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error updating user password' })
  }
}
