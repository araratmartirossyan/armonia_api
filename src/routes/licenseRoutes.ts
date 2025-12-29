import { Router } from 'express'
import {
  createLicense,
  listLicenses,
  deactivateLicense,
  activateLicense,
  getLicense,
  updateLicenseValidity,
  setLicenseKnowledgeBases,
} from '../controllers/licenseController'
import { authMiddleware } from '../middlewares/auth'
import { roleGuard } from '../middlewares/roleGuard'
import { UserRole } from '../entities/User'

const router = Router()

router.use(authMiddleware)

/**
 * @swagger
 * /licenses:
 *   post:
 *     summary: Create a new license (Admin only)
 *     tags: [Licenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateLicenseRequest'
 *     responses:
 *       201:
 *         description: License created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/License'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error creating license
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', roleGuard([UserRole.ADMIN]), createLicense)

/**
 * @swagger
 * /licenses:
 *   get:
 *     summary: List all licenses (Admin only)
 *     tags: [Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 20 }
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, expiresAt, isActive]
 *       - in: query
 *         name: sortDir
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *     responses:
 *       200:
 *         description: Paginated list of licenses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedLicensesResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error listing licenses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', roleGuard([UserRole.ADMIN]), listLicenses)

/**
 * @swagger
 * /licenses/{id}:
 *   get:
 *     summary: Get a specific license by ID (Admin only)
 *     tags: [Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: License ID
 *     responses:
 *       200:
 *         description: License details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/License'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error fetching license
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', roleGuard([UserRole.ADMIN]), getLicense)

/**
 * @swagger
 * /licenses/{id}:
 *   put:
 *     summary: Update a license validity period (Admin only)
 *     tags: [Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: License ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateLicenseRequest'
 *     responses:
 *       200:
 *         description: Updated license
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/License'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error updating license
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id', roleGuard([UserRole.ADMIN]), updateLicenseValidity)

/**
 * @swagger
 * /licenses/{id}/knowledge-bases:
 *   put:
 *     summary: Set/replace knowledge bases assigned to a license (Admin only)
 *     tags: [Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SetLicenseKnowledgeBasesRequest'
 *     responses:
 *       200:
 *         description: Updated license with assigned knowledge bases
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/License'
 *       400:
 *         description: Invalid input or KB not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: License not found
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Error updating license knowledge bases
 */
router.put('/:id/knowledge-bases', roleGuard([UserRole.ADMIN]), setLicenseKnowledgeBases)

/**
 * @swagger
 * /licenses/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a license (Admin only)
 *     tags: [Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: License ID
 *     responses:
 *       200:
 *         description: License deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: License deactivated successfully
 *                 license:
 *                   $ref: '#/components/schemas/License'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error deactivating license
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/:id/deactivate', roleGuard([UserRole.ADMIN]), deactivateLicense)

/**
 * @swagger
 * /licenses/{id}/activate:
 *   patch:
 *     summary: Activate a license (Admin only)
 *     tags: [Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: License ID
 *     responses:
 *       200:
 *         description: License activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: License activated successfully
 *                 license:
 *                   $ref: '#/components/schemas/License'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error activating license
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch('/:id/activate', roleGuard([UserRole.ADMIN]), activateLicense)

export default router
