import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db';
import { authenticateToken } from '../middleware/authMiddleware';
import fs from 'fs';
import path from 'path';

const router = Router();

const uploadsDir = path.join(__dirname, '../../uploads/music');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, cb) => cb(null, uploadsDir),
		filename: (_req, file, cb) => {
			const ext = path.extname(file.originalname) || '.mp3';
			cb(null, `music_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
		},
	}),
	limits: { fileSize: 90 * 1024 * 1024 }, // 90MB for audio
	fileFilter: (_req, file, cb) => {
		if (!file.mimetype.startsWith('audio/')) {
			return cb(new Error('Only audio files are allowed'));
		}
		cb(null, true);
	},
});

// GET /music/active  — public, no auth required
router.get('/active', async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT id, filename, file_url, is_active, volume, created_at
			 FROM music
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

// GET /music/check — check if table exists
router.get('/check', async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = 'music'`
		);
		return res.json({ exists: result.rows.length > 0 });
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

// GET /music  — list all, auth required
router.get('/', authenticateToken, async (req, res) => {
	try {
		const result = await pool.query(
			`SELECT id, filename, file_url, is_active, volume, created_at
			 FROM music
			 ORDER BY created_at DESC`
		);
		return res.json(result.rows);
	} catch (error: any) {
		if (error?.code === '42P01') {
			return res.status(500).json({
				error: 'Table music does not exist. Run drizzle/0011_music.sql first.',
			});
		}
		return res.status(500).json({ error: error.message });
	}
});

// POST /music/upload  — upload audio file, auth required
router.post('/upload', authenticateToken, upload.single('audioFile'), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ error: 'No audio file provided' });
		}

		const baseUrl = `${req.protocol}://${req.get('host')}`;
		const fileUrl = `${baseUrl}/uploads/music/${req.file.filename}`;

		const result = await pool.query(
			`INSERT INTO music (filename, file_url, is_active, volume)
			 VALUES ($1, $2, FALSE, 0.35)
			 RETURNING id, filename, file_url, is_active, volume, created_at`,
			[req.file.filename, fileUrl]
		);

		return res.status(201).json(result.rows[0]);
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

// PUT /music/:id/volume  — update volume, auth required
router.put('/:id/volume', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const { volume } = req.body;
		if (typeof volume !== 'number' || volume < 0 || volume > 1) {
			return res.status(400).json({ error: 'Volume must be a number between 0 and 1' });
		}
		const result = await pool.query(
			`UPDATE music SET volume = $1 WHERE id = $2
			 RETURNING id, filename, file_url, is_active, volume, created_at`,
			[volume, id]
		);
		if (result.rows.length === 0) {
			return res.status(404).json({ error: 'Music track not found' });
		}
		return res.json(result.rows[0]);
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

// PUT /music/:id/activate  — set as active (all others deactivated), auth required
router.put('/:id/activate', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		// deactivate all
		await pool.query(`UPDATE music SET is_active = FALSE`);
		// activate target
		const result = await pool.query(
			`UPDATE music SET is_active = TRUE WHERE id = $1
			 RETURNING id, filename, file_url, is_active, volume, created_at`,
			[id]
		);
		if (result.rows.length === 0) {
			return res.status(404).json({ error: 'Music track not found' });
		}
		return res.json(result.rows[0]);
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

// PUT /music/deactivate-all  — turn off background music, auth required
router.put('/deactivate-all', authenticateToken, async (req, res) => {
	try {
		await pool.query(`UPDATE music SET is_active = FALSE`);
		return res.json({ ok: true });
	} catch (error: any) {
		return res.status(500).json({ error: error.message });
	}
});

// DELETE /music/:id  — delete audio file + file, auth required
router.delete('/:id', authenticateToken, async (req, res) => {
	try {
		const { id } = req.params;
		const result = await pool.query(
			`DELETE FROM music WHERE id = $1 RETURNING filename`,
			[id]
		);
		if (result.rows.length === 0) {
			return res.status(404).json({ error: 'Music track not found' });
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