import { Router } from 'express';
import { chat, uploadDocument } from '../controllers/ragController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /rag/chat:
 *   post:
 *     summary: Query the RAG system
 *     description: >
 *       If the license has no knowledge base attached, the system will answer using global knowledge.
 *       If multiple knowledge bases are attached and `kbId` is not provided, the backend will auto-select the most relevant KB for the question.
 *       When the global provider is OpenAI, the backend may use OpenAI's `web_search` tool and return web citations.
 *     tags: [RAG]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       200:
 *         description: Answer from RAG system
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - License access denied
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
 *       500:
 *         description: Error processing query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/chat', chat);

/**
 * @swagger
 * /rag/upload:
 *   post:
 *     summary: Upload and ingest a document
 *     tags: [RAG]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UploadDocumentRequest'
 *     responses:
 *       200:
 *         description: Document ingested successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Document ingested successfully
 *       500:
 *         description: Error ingesting document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/upload', uploadDocument);

export default router;
