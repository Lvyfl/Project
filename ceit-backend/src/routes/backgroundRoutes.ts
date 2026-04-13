import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import fs from 'fs';
import path from 'path';

const router = Router();

const uploadsDir = path.join(__dirname, '../../uploads/backgrounds');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, cb) => cb(null, uploadsDir),
		filename: (_req, file, cb) => {
			const ext = path.extname(file.originalname) || '.jpg';
			cb(null, `bg_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
		},
	}),
	limits: { fileSize: 10 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (!file.mimetype.startsWith('image/')) {
			return cb(new Error('Only image files are allowed'));
		}
		cb(null, true);
	},
});

// GET /backgrounds/active  — public, no auth required
router.get('/active', async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT id, filename, image_url, is_active, created_at
			 FROM backgrounds
			 WHERE is_active = TRUE
			 ORDER BY created_at DESC
			 LIMIT 1`
		);
		if (result.rows.length === 0) return res.json(null);
		return res.json(result.rows[0]);
	} catch (error: any) {
		if (error?.code === '42P01') {
			return res.status(200).json(null);
		}
		return res.status(500).json({ error: error.message });
	}
});

// GET /backgrounds  — list all, auth required
router.get('/', authenticateToken, async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT id, filename, image_url, is_active, created_at
			 FROM backgrounds
			 ORDER BY created_at DESC`
		);
		return res.json(result.rows);
	} catch (error: any) {
		if (error?.code === '42P01') {
			return res.status(500).json({
				error: 'Table backgrounds does not exist. Run drizzle/0005_backgrounds.sql first.',
			});
		}
		return res.status(500).json({ error: error.message });
	}
});

// POST /backgrounds/upload  — upload image, auth required
router.post('/upload', authenticateToken, upload.single('bgImage'), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ error: 'No image file provided' });
		}

		const baseUrl = `${req.protocol}://${req.get('host')}`;
		const imageUrl = `${baseUrl}/uploads/backgrounds/${req.file.filename}`;

		const result = await pool.query(
			`INSERT INTO backgrounds (filename, image_url, is_active)
			 VALUES ($1, $2, FALSE)
			 RETURNING id, filename, image_url, is_active, created_at`,
			[req.file.filename, imageUrl]
		);

		return res.status(201).json(result.rows[0]);
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

// PUT /backgrounds/:id/activate  — set as active (all others deactivated), auth required
router.put('/:id/activate', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		// deactivate all
		await pool.query(`UPDATE backgrounds SET is_active = FALSE`);
		// activate target
		const result = await pool.query(
			`UPDATE backgrounds SET is_active = TRUE WHERE id = $1
			 RETURNING id, filename, image_url, is_active, created_at`,
			[id]
		);
		if (result.rows.length === 0) {
			return res.status(404).json({ error: 'Background not found' });
		}
		return res.json(result.rows[0]);
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

// PUT /backgrounds/deactivate-all  — turn off background, auth required
router.put('/deactivate-all', authenticateToken, async (req, res) => {
	try {
		await pool.query(`UPDATE backgrounds SET is_active = FALSE`);
		return res.json({ ok: true });
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

// DELETE /backgrounds/:id  — delete image + file, auth required
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const result = await pool.query(
			`DELETE FROM backgrounds WHERE id = $1 RETURNING filename`,
			[id]
		);
		if (result.rows.length === 0) {
			return res.status(404).json({ error: 'Background not found' });
		}
		// Remove file from disk
		const filePath = path.join(uploadsDir, result.rows[0].filename);
		fs.unlink(filePath, () => {}); // ignore errors if already gone
		return res.json({ ok: true });
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

export default router;
