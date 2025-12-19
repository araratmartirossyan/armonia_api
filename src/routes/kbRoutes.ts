import { Router } from 'express';
import {
  createKnowledgeBase,
  listKnowledgeBases,
  attachToLicense,
  getKnowledgeBase,
  uploadPDF,
  deleteKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBaseDocument,
  reindexKnowledgeBase,
  downloadKnowledgeBaseDocument,
} from '../controllers/kbController';
import { authMiddleware } from '../middlewares/auth';
import { roleGuard } from '../middlewares/roleGuard';
import { UserRole } from '../entities/User';
import { upload } from '../utils/fileUpload';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /knowledge-bases:
 *   post:
 *     summary: Create a new knowledge base (Admin only)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateKnowledgeBaseRequest'
 *     responses:
 *       201:
 *         description: Knowledge base created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KnowledgeBase'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error creating knowledge base
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', roleGuard([UserRole.ADMIN]), createKnowledgeBase);

/**
 * @swagger
 * /knowledge-bases:
 *   get:
 *     summary: List all knowledge bases (Admin only)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of knowledge bases
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/KnowledgeBase'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error listing knowledge bases
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', roleGuard([UserRole.ADMIN]), listKnowledgeBases);

/**
 * @swagger
 * /knowledge-bases/attach:
 *   post:
 *     summary: Attach a knowledge base to a license (Admin only)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AttachKnowledgeBaseRequest'
 *     responses:
 *       200:
 *         description: Knowledge base attached successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Knowledge Base attached to License successfully
 *       404:
 *         description: Knowledge Base or License not found
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
 *         description: Error attaching knowledge base
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/attach', roleGuard([UserRole.ADMIN]), attachToLicense);

/**
 * @swagger
 * /knowledge-bases/{id}:
 *   get:
 *     summary: Get a specific knowledge base by ID (Admin only)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Knowledge Base ID
 *     responses:
 *       200:
 *         description: Knowledge base details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KnowledgeBase'
 *       404:
 *         description: Knowledge base not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error fetching knowledge base
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', roleGuard([UserRole.ADMIN]), getKnowledgeBase);

/**
 * @swagger
 * /knowledge-bases/{id}:
 *   put:
 *     summary: Update a knowledge base (Admin only)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Knowledge Base ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Knowledge Base name
 *               description:
 *                 type: string
 *                 nullable: true
 *                 description: Knowledge Base description
 *               promptInstructions:
 *                 type: string
 *                 nullable: true
 *                 description: Custom prompt instructions for this knowledge base
 *     responses:
 *       200:
 *         description: Knowledge base updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/KnowledgeBase'
 *       404:
 *         description: Knowledge base not found
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
 *         description: Error updating knowledge base
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id', roleGuard([UserRole.ADMIN]), updateKnowledgeBase);

/**
 * @swagger
 * /knowledge-bases/{id}/upload:
 *   post:
 *     summary: Upload multiple PDF files to a knowledge base (Admin only)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Knowledge Base ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: PDF files to upload (up to 10 files)
 *     responses:
 *       201:
 *         description: PDF files uploaded and ingested successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 2 PDF file(s) uploaded and ingested successfully
 *                 documents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       fileName:
 *                         type: string
 *                       pageCount:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fileName:
 *                         type: string
 *                       error:
 *                         type: string
 *                   description: Errors for files that failed to upload (if any)
 *       400:
 *         description: Bad request - No files uploaded or all files failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Knowledge base not found
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
 *         description: Error uploading PDFs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:id/upload', roleGuard([UserRole.ADMIN]), upload.array('files', 10), uploadPDF);

/**
 * @swagger
 * /knowledge-bases/{id}/reindex:
 *   post:
 *     summary: Rebuild vector index for a knowledge base by re-ingesting stored PDFs (Admin only)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Knowledge Base ID
 *     responses:
 *       200:
 *         description: Reindex completed
 *       400:
 *         description: No documents found for this knowledge base
 *       404:
 *         description: Knowledge base not found
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Error reindexing knowledge base
 */
router.post('/:id/reindex', roleGuard([UserRole.ADMIN]), reindexKnowledgeBase);

/**
 * @swagger
 * /knowledge-bases/{id}/documents/{documentId}:
 *   delete:
 *     summary: Delete a document from a knowledge base by document ID (Admin only)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Knowledge Base ID
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Document deleted successfully
 *                 documentId:
 *                   type: string
 *                   format: uuid
 *       404:
 *         description: Document not found in this knowledge base
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
 *         description: Error deleting document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id/documents/:documentId', roleGuard([UserRole.ADMIN]), deleteKnowledgeBaseDocument);

/**
 * @swagger
 * /knowledge-bases/{id}/documents/{documentId}/file:
 *   get:
 *     summary: Download/view a knowledge base document PDF (Admin or licensed user)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: PDF file stream
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get('/:id/documents/:documentId/file', downloadKnowledgeBaseDocument);

/**
 * @swagger
 * /knowledge-bases/{id}:
 *   delete:
 *     summary: Delete a knowledge base (Admin only)
 *     tags: [Knowledge Bases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Knowledge Base ID
 *     responses:
 *       200:
 *         description: Knowledge base deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Knowledge base deleted successfully
 *                 deletedDocuments:
 *                   type: number
 *                   description: Number of documents that were deleted
 *       404:
 *         description: Knowledge base not found
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
 *         description: Error deleting knowledge base
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', roleGuard([UserRole.ADMIN]), deleteKnowledgeBase);

export default router;
