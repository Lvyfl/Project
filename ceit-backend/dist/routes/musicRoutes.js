"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const db_1 = require("../db");
const authMiddleware_1 = require("../middleware/authMiddleware");
const blob_1 = require("@vercel/blob");
const client_1 = require("@vercel/blob/client");
const publicMediaRewriter_1 = require("../utils/publicMediaRewriter");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 },
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
        const result = await db_1.pool.query(`SELECT id, filename, file_url, is_active, volume, created_at
			 FROM music
			 WHERE is_active = TRUE
			 ORDER BY created_at DESC
			 LIMIT 1`);
        if (result.rows.length === 0)
            return res.json(null);
        const row = result.rows[0];
        const rewrite = (0, publicMediaRewriter_1.buildPublicMediaRewriter)(req);
        row.file_url = rewrite(row.file_url);
        return res.json(row);
    }
    catch (error) {
        if (error?.code === '42P01') {
            return res.status(200).json(null);
        }
        return res.status(500).json({ error: error.message });
    }
});
// GET /music/check — check if table exists
router.get('/check', async (req, res) => {
    try {
        const result = await db_1.pool.query(`SELECT table_name FROM information_schema.tables WHERE table_name = 'music'`);
        return res.json({ exists: result.rows.length > 0 });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// GET /music  — list all, auth required
router.get('/', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const result = await db_1.pool.query(`SELECT id, filename, file_url, is_active, volume, created_at
			 FROM music
			 ORDER BY created_at DESC`);
        return res.json(result.rows);
    }
    catch (error) {
        if (error?.code === '42P01') {
            return res.status(500).json({
                error: 'Table music does not exist. Run drizzle/0011_music.sql first.',
            });
        }
        return res.status(500).json({ error: error.message });
    }
});
const handleMusicUpload = (req, res, next) => {
    upload.single('audioFile')(req, res, (err) => {
        if (err) {
            if (err instanceof multer_1.default.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'Audio file is too large. Maximum file size is 200MB.' });
            }
            return res.status(400).json({ error: err.message || 'Failed to process audio upload' });
        }
        next();
    });
};
// POST /music/upload  — upload audio file, auth required
router.post('/upload', authMiddleware_1.authenticateToken, handleMusicUpload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        const ext = req.file.originalname.substring(req.file.originalname.lastIndexOf('.'));
        const blobName = `music_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
        const blob = await (0, blob_1.put)(blobName, req.file.buffer, {
            access: 'public',
        });
        const result = await db_1.pool.query(`INSERT INTO music (filename, file_url, is_active, volume)
			 VALUES ($1, $2, FALSE, 0.35)
			 RETURNING id, filename, file_url, is_active, volume, created_at`, [req.file.originalname, blob.url]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Music upload error:', error);
        return res.status(500).json({ error: error.message || 'Failed to upload music' });
    }
});
// POST /music/upload/token — generate a short-lived direct upload token for the client
router.post('/upload/token', authMiddleware_1.authenticateToken, async (req, res) => {
    const { pathname } = req.body;
    if (typeof pathname !== 'string' || pathname.trim() === '') {
        return res.status(400).json({ error: 'Upload pathname is required' });
    }
    try {
        const validUntil = new Date();
        validUntil.setMinutes(validUntil.getMinutes() + 10);
        const clientToken = await (0, client_1.generateClientTokenFromReadWriteToken)({
            pathname,
            validUntil: validUntil.getTime(),
        });
        return res.json({ clientToken });
    }
    catch (error) {
        console.error('Music upload token error:', error);
        return res.status(500).json({ error: error.message || 'Failed to generate upload token' });
    }
});
// POST /music/upload/direct — record metadata once client-side direct upload is complete
router.post('/upload/direct', authMiddleware_1.authenticateToken, async (req, res) => {
    const { filename, url } = req.body;
    if (typeof filename !== 'string' || filename.trim() === '' || typeof url !== 'string' || url.trim() === '') {
        return res.status(400).json({ error: 'filename and url are required' });
    }
    try {
        const result = await db_1.pool.query(`INSERT INTO music (filename, file_url, is_active, volume)
			 VALUES ($1, $2, FALSE, 0.35)
			 RETURNING id, filename, file_url, is_active, volume, created_at`, [filename, url]);
        return res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Music direct upload finalize error:', error);
        return res.status(500).json({ error: error.message || 'Failed to save uploaded music' });
    }
});
// PUT /music/:id/volume  — update volume, auth required
router.put('/:id/volume', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { volume } = req.body;
        if (typeof volume !== 'number' || volume < 0 || volume > 1) {
            return res.status(400).json({ error: 'Volume must be a number between 0 and 1' });
        }
        const result = await db_1.pool.query(`UPDATE music SET volume = $1 WHERE id = $2
			 RETURNING id, filename, file_url, is_active, volume, created_at`, [volume, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Music track not found' });
        }
        return res.json(result.rows[0]);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// PUT /music/:id/activate  — set as active (all others deactivated), auth required
router.put('/:id/activate', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // deactivate all
        await db_1.pool.query(`UPDATE music SET is_active = FALSE`);
        // activate target
        const result = await db_1.pool.query(`UPDATE music SET is_active = TRUE WHERE id = $1
			 RETURNING id, filename, file_url, is_active, volume, created_at`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Music track not found' });
        }
        return res.json(result.rows[0]);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// PUT /music/deactivate-all  — turn off background music, auth required
router.put('/deactivate-all', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        await db_1.pool.query(`UPDATE music SET is_active = FALSE`);
        return res.json({ ok: true });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// DELETE /music/:id  — delete audio record, auth required
router.delete('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db_1.pool.query(`DELETE FROM music WHERE id = $1 RETURNING filename`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Music track not found' });
        }
        return res.json({ ok: true });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
exports.default = router;
