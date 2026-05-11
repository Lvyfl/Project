import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import { put } from '@vercel/blob';

const router = Router();

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024,
	},
	fileFilter: (_req, file, cb) => {
		if (file.mimetype !== 'application/pdf') {
			return cb(new Error('Only PDF files are allowed'));
		}
		cb(null, true);
	},
});

router.get('/', async (req, res) => {
	try {
		const rawLimit = Number(req.query.limit);
		const rawOffset = Number(req.query.offset);
		const limit = Number.isFinite(rawLimit)
			? Math.max(1, Math.min(100, Math.trunc(rawLimit)))
			: 20;
		const offset = Number.isFinite(rawOffset)
			? Math.max(0, Math.trunc(rawOffset))
			: 0;

		const result = await pool.query(
			`SELECT id, filename, mimetype, size, url, created_at
			 FROM pdf_documents
			 ORDER BY created_at DESC
			 LIMIT $1 OFFSET $2`,
			[limit, offset]
		);

		return res.status(200).json(result.rows);
	} catch (error: any) {
		if (error?.code === '42P01') {
			return res.status(500).json({
				error: 'Database table pdf_documents does not exist. Run drizzle/0001_pdf_documents.sql then retry.',
			});
		}
		const message = error?.message || 'Failed to retrieve uploaded documents';
		return res.status(500).json({ error: message });
	}
});

router.post('/upload', authenticateToken, upload.single('pdfFile'), async (req, res) => {
	try {
		const file = req.file;
		if (!file) return res.status(400).json({ error: 'PDF file is required' });
		if (file.mimetype !== 'application/pdf') {
			return res.status(400).json({ error: 'Please upload a valid PDF file' });
		}

		const blob = await put(`${Date.now()}-${file.originalname}`, file.buffer, {
			access: 'public',
		});

		const result = await pool.query(
			'INSERT INTO pdf_documents (filename, mimetype, size, url) VALUES ($1, $2, $3, $4) RETURNING id, filename, mimetype, size, url, created_at',
			[file.originalname, file.mimetype, file.size, blob.url]
		);

		return res.status(201).json(result.rows[0]);
	} catch (error: any) {
		if (error?.code === '42P01') {
			return res.status(500).json({
				error: 'Database table pdf_documents does not exist. Run drizzle/0001_pdf_documents.sql then retry.',
			});
		}
		const message = error?.message || 'Failed to upload PDF';
		return res.status(500).json({ error: message });
	}
});

router.get('/:id/meta', async (req, res) => {
	try {
		const id = String(req.params.id || '').trim();
		if (!id) return res.status(400).json({ error: 'Document id is required' });

		const result = await pool.query(
			'SELECT id, filename, mimetype, size, url, created_at FROM pdf_documents WHERE id = $1',
			[id]
		);

		if (result.rows.length === 0) {
			return res.status(404).json({ error: 'PDF not found' });
		}
		return res.status(200).json(result.rows[0]);
	} catch (error: any) {
		if (error?.code === '42P01') {
			return res.status(500).json({
				error: 'Database table pdf_documents does not exist. Run drizzle/0001_pdf_documents.sql then retry.',
			});
		}
		const message = error?.message || 'Failed to retrieve PDF metadata';
		return res.status(500).json({ error: message });
	}
});

router.get('/:id', async (req, res) => {
	try {
		const id = String(req.params.id || '').trim();
		if (!id) return res.status(400).json({ error: 'Document id is required' });

		const result = await pool.query(
			'SELECT filename, mimetype, size, url FROM pdf_documents WHERE id = $1',
			[id]
		);

		if (result.rows.length === 0) {
			return res.status(404).json({ error: 'PDF not found' });
		}

		const doc = result.rows[0] as { filename: string; mimetype: string; size: number; url: string };

		const safeName = String(doc.filename || 'document.pdf')
			.replace(/\r|\n/g, ' ')
			.replace(/"/g, "'")
			.slice(0, 180);

		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
		if (typeof doc.size === 'number' && doc.size >= 0) {
			res.setHeader('Content-Length', String(doc.size));
		}

		// Redirect to blob URL
		res.redirect(doc.url);
	} catch (error: any) {
		if (error?.code === '42P01') {
			return res.status(500).json({
				error: 'Database table pdf_documents does not exist. Run drizzle/0001_pdf_documents.sql then retry.',
			});
		}
		const message = error?.message || 'Failed to retrieve PDF';
		return res.status(500).json({ error: message });
	}
});

export default router;
