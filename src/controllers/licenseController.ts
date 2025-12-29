import { Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { License } from '../entities/License'
import { User } from '../entities/User'
import { sanitizeUser } from '../utils/userUtils'
import { randomUUID } from 'crypto'
import { buildMeta, parsePaginationQuery, pickSort } from '../utils/pagination'
import { KnowledgeBase } from '../entities/KnowledgeBase'
import { z } from 'zod'
import { In } from 'typeorm'
import type { FindOptionsOrder } from 'typeorm'

const licenseRepository = AppDataSource.getRepository(License)
const userRepository = AppDataSource.getRepository(User)
const kbRepository = AppDataSource.getRepository(KnowledgeBase)

/**
 * Helper function to check if a license is valid (active and not expired)
 */
export const isLicenseValid = (license: License): boolean => {
  if (!license.isActive) {
    return false
  }
  if (license.expiresAt && new Date() > license.expiresAt) {
    return false
  }
  return true
}

export const createLicense = async (req: Request, res: Response) => {
  const { userId, validityPeriodDays } = req.body

  try {
    const user = await userRepository.findOne({
      where: { id: userId },
      relations: ['license'],
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Check if user already has a license
    if (user.license) {
      return res.status(400).json({
        message: 'User already has a license. Each user can only have one license.',
        existingLicenseId: user.license.id,
      })
    }

    // Calculate expiration date if validityPeriodDays is provided
    let expiresAt: Date | null = null
    if (validityPeriodDays && typeof validityPeriodDays === 'number' && validityPeriodDays > 0) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + validityPeriodDays)
    }

    const license = licenseRepository.create({
      key: randomUUID(),
      user: { id: user.id },
      expiresAt,
      isActive: true,
    })

    await licenseRepository.save(license)

    // Reload with relations and sanitize user
    const savedLicense = await licenseRepository.findOne({
      where: { id: license.id },
      relations: ['user', 'knowledgeBases'],
    })

    if (!savedLicense) {
      return res.status(500).json({ message: 'Error retrieving created license' })
    }

    return res.status(201).json({
      ...savedLicense,
      user: sanitizeUser(savedLicense.user),
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error creating license' })
  }
}

export const listLicenses = async (req: Request, res: Response) => {
  try {
    const parsed = parsePaginationQuery(req.query, { defaultSortDir: 'ASC' }) // keep old default: oldest -> newest
    if (!parsed.ok) {
      return res
        .status(400)
        .json({ message: 'Invalid pagination params', issues: parsed.error.format() })
    }

    const { sortBy, sortDir } = pickSort(
      parsed.sortBy,
      parsed.sortDir,
      ['createdAt', 'updatedAt', 'expiresAt', 'isActive'] as const,
      'createdAt',
    )

    const order = { [sortBy]: sortDir } as FindOptionsOrder<License>
    const [licenses, totalItems] = await licenseRepository.findAndCount({
      relations: ['user', 'knowledgeBases'],
      skip: parsed.skip,
      take: parsed.take,
      order,
    })
    // Add validation status and sanitize user data
    const licensesWithStatus = licenses.map(license => ({
      ...license,
      user: sanitizeUser(license.user),
      isValid: isLicenseValid(license),
    }))

    return res.json({
      items: licensesWithStatus,
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
    return res.status(500).json({ message: 'Error listing licenses' })
  }
}

const setLicenseKnowledgeBasesSchema = z.object({
  kbIds: z.array(z.string().uuid()).default([]),
})

export const setLicenseKnowledgeBases = async (req: Request, res: Response) => {
  const { id } = req.params

  const parsed = setLicenseKnowledgeBasesSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.format() })
  }

  try {
    const license = await licenseRepository.findOne({
      where: { id },
      relations: ['user', 'knowledgeBases'],
    })
    if (!license) return res.status(404).json({ message: 'License not found' })

    const kbIds = Array.from(new Set(parsed.data.kbIds))
    const kbs = kbIds.length ? await kbRepository.findBy({ id: In(kbIds) }) : []

    if (kbs.length !== kbIds.length) {
      const found = new Set(kbs.map(k => k.id))
      const missing = kbIds.filter(x => !found.has(x))
      return res
        .status(400)
        .json({ message: 'Some knowledge bases not found', missingKbIds: missing })
    }

    license.knowledgeBases = kbs
    await licenseRepository.save(license)

    const updated = await licenseRepository.findOne({
      where: { id: license.id },
      relations: ['user', 'knowledgeBases'],
    })

    if (!updated) return res.status(500).json({ message: 'Error retrieving updated license' })

    return res.json({
      ...updated,
      user: sanitizeUser(updated.user),
      isValid: isLicenseValid(updated),
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error updating license knowledge bases' })
  }
}

export const updateLicenseValidity = async (req: Request, res: Response) => {
  const { id } = req.params
  const { validityPeriodDays } = req.body

  try {
    const license = await licenseRepository.findOne({
      where: { id },
      relations: ['user', 'knowledgeBases'],
    })

    if (!license) {
      return res.status(404).json({ message: 'License not found' })
    }

    if (validityPeriodDays === null || validityPeriodDays === undefined) {
      // Allow clearing expiration (never expires)
      license.expiresAt = null
    } else if (
      typeof validityPeriodDays === 'number' &&
      Number.isFinite(validityPeriodDays) &&
      validityPeriodDays > 0
    ) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + validityPeriodDays)
      license.expiresAt = expiresAt
    } else {
      return res.status(400).json({
        message: 'validityPeriodDays must be a positive number, null, or omitted',
      })
    }

    await licenseRepository.save(license)

    const updatedLicense = await licenseRepository.findOne({
      where: { id: license.id },
      relations: ['user', 'knowledgeBases'],
    })

    if (!updatedLicense) {
      return res.status(500).json({ message: 'Error retrieving updated license' })
    }

    return res.json({
      ...updatedLicense,
      user: sanitizeUser(updatedLicense.user),
      isValid: isLicenseValid(updatedLicense),
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error updating license' })
  }
}

export const deactivateLicense = async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const license = await licenseRepository.findOneBy({ id })
    if (!license) {
      return res.status(404).json({ message: 'License not found' })
    }

    license.isActive = false
    await licenseRepository.save(license)

    // Reload with relations and sanitize user
    const updatedLicense = await licenseRepository.findOne({
      where: { id: license.id },
      relations: ['user', 'knowledgeBases'],
    })

    return res.json({
      message: 'License deactivated successfully',
      license: updatedLicense
        ? {
            ...updatedLicense,
            user: sanitizeUser(updatedLicense.user),
          }
        : license,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error deactivating license' })
  }
}

export const activateLicense = async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const license = await licenseRepository.findOneBy({ id })
    if (!license) {
      return res.status(404).json({ message: 'License not found' })
    }

    license.isActive = true
    await licenseRepository.save(license)

    // Reload with relations and sanitize user
    const updatedLicense = await licenseRepository.findOne({
      where: { id: license.id },
      relations: ['user', 'knowledgeBases'],
    })

    return res.json({
      message: 'License activated successfully',
      license: updatedLicense
        ? {
            ...updatedLicense,
            user: sanitizeUser(updatedLicense.user),
          }
        : license,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error activating license' })
  }
}

export const getLicense = async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const license = await licenseRepository.findOne({
      where: { id },
      relations: ['user', 'knowledgeBases'],
    })

    if (!license) {
      return res.status(404).json({ message: 'License not found' })
    }

    return res.json({
      ...license,
      user: sanitizeUser(license.user),
      isValid: isLicenseValid(license),
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Error fetching license' })
  }
}
