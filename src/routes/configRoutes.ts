import { Router } from 'express'
import { getAIConfig, updateAIConfig } from '../controllers/configController'
import { authMiddleware } from '../middlewares/auth'
import { roleGuard } from '../middlewares/roleGuard'
import { UserRole } from '../entities/User'

const router = Router()

router.use(authMiddleware)

/**
 * @swagger
 * /config/ai:
 *   get:
 *     summary: Get global AI configuration (Admin only)
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global AI configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIConfiguration'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error fetching configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/ai', roleGuard([UserRole.ADMIN]), getAIConfig)

/**
 * @swagger
 * /config/ai:
 *   put:
 *     summary: Update global AI configuration (Admin only)
 *     tags: [Configuration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAIConfigRequest'
 *     responses:
 *       200:
 *         description: AI configuration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIConfiguration'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error updating configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/ai', roleGuard([UserRole.ADMIN]), updateAIConfig)

export default router
