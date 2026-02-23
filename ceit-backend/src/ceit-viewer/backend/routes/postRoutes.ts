import { Router } from 'express';
import { createPost, getPosts, updatePost, deletePost, getPublicPosts, getPostById } from '../controllers/postController';
import { authenticateToken } from '../../../middleware/authMiddleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../../../db';

const router = Router();

// Public route - no authentication required
router.get('/public', getPublicPosts);
router.get('/public/:id', getPostById);

// Protected routes
router.use(authenticateToken);

// Multipart upload (PDF + thumbnail)
const uploadsDir = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024,
	},
});

function safeFileName(originalName: string, fallbackExt: string) {
	const parsed = path.parse(originalName || 'file');
	const safeBase = (parsed.name || 'file').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
	const ext = (parsed.ext || fallbackExt || '').toLowerCase() || fallbackExt;
	const uniq = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
	return `${safeBase}_${uniq}${ext}`;
}

router.post(
	'/upload',
	upload.fields([
		{ name: 'pdfFile', maxCount: 1 },
		{ name: 'thumbnailFile', maxCount: 1 },
	]),
	async (req: any, res) => {
		try {
			const caption = String(req.body?.caption || '').trim();
			if (!caption) {
				return res.status(400).json({ error: 'Document caption is required' });
			}

			const files = req.files as Record<string, Express.Multer.File[]> | undefined;
			const pdf = files?.pdfFile?.[0];
			const thumb = files?.thumbnailFile?.[0];
			if (!pdf) return res.status(400).json({ error: 'PDF file is required' });
			if (!thumb) return res.status(400).json({ error: 'Thumbnail image is required' });

			if (pdf.mimetype !== 'application/pdf') {
				return res.status(400).json({ error: 'Please upload a valid PDF file' });
			}
			if (!thumb.mimetype.startsWith('image/')) {
				return res.status(400).json({ error: 'Please upload a valid thumbnail image' });
			}
			if (thumb.size > 5 * 1024 * 1024) {
				return res.status(400).json({ error: 'Thumbnail size must be less than 5MB' });
			}

			// Store PDF in PostgreSQL (BYTEA) using parameterized query
			let insert;
			try {
				insert = await pool.query(
				'INSERT INTO pdf_documents (filename, mimetype, size, data) VALUES ($1, $2, $3, $4) RETURNING id',
				[pdf.originalname, pdf.mimetype, pdf.size, pdf.buffer]
				);
			} catch (e: any) {
				if (e?.code === '42P01') {
					return res.status(500).json({
						error: 'Database table pdf_documents does not exist. Run drizzle/0001_pdf_documents.sql then retry.',
					});
				}
				throw e;
			}
			const documentId: string | undefined = insert.rows?.[0]?.id;
			if (!documentId) return res.status(500).json({ error: 'Failed to store PDF in database' });

			// Store thumbnail on disk
			const thumbExt = path.extname(thumb.originalname || '') || '.png';
			const thumbFileName = safeFileName(thumb.originalname, thumbExt);
			const thumbFullPath = path.join(uploadsDir, thumbFileName);
			await fs.promises.writeFile(thumbFullPath, thumb.buffer);

			const baseUrl = `${req.protocol}://${req.get('host')}`;
			const pdfUrl = `${baseUrl}/documents/${encodeURIComponent(documentId)}`;
			const thumbUrl = `${baseUrl}/uploads/${encodeURIComponent(thumbFileName)}`;

			// Reuse existing JSON endpoint for DB insert
			req.body.imageUrl = `${pdfUrl}|${thumbUrl}`;
			req.body.caption = caption;
			return createPost(req, res);
		} catch (error: any) {
			return res.status(500).json({ error: error.message });
		}
	}
);

router.post('/', createPost);
router.get('/', getPosts);
router.get('/:id', getPostById);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

export default router;
