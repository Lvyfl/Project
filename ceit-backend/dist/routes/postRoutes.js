"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const postController_1 = require("../controllers/postController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const blob_1 = require("@vercel/blob");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.get('/public', postController_1.getPublicPosts);
router.get('/public/departments', postController_1.getPostDepartments);
router.get('/public/department-counts', postController_1.getPostDepartmentCounts);
router.get('/public/:id', postController_1.getPostById);
router.post('/public/:id/like', postController_1.likePublicPost);
router.post('/public/:id/view', postController_1.trackPostView);
router.use(authMiddleware_1.authenticateToken);
router.get('/engagement', postController_1.getPostEngagement);
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});
function safeFileName(originalName, fallbackExt) {
    const parsed = path_1.default.parse(originalName || 'file');
    const safeBase = (parsed.name || 'file').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
    const ext = (parsed.ext || fallbackExt || '').toLowerCase() || fallbackExt;
    const uniq = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return `${safeBase}_${uniq}${ext}`;
}
router.post('/upload', upload.fields([
    { name: 'pdfFile', maxCount: 1 },
    { name: 'thumbnailFile', maxCount: 1 },
]), async (req, res) => {
    try {
        const title = String(req.body?.title ?? '').trim();
        const legacyCaption = String(req.body?.caption ?? '').trim();
        const captionForDb = title || legacyCaption;
        if (!captionForDb) {
            return res.status(400).json({ error: 'Document title is required' });
        }
        const bodyForDb = String(req.body?.body ?? '').trim() || null;
        const files = req.files;
        const pdf = files?.pdfFile?.[0];
        const thumb = files?.thumbnailFile?.[0];
        if (!pdf)
            return res.status(400).json({ error: 'PDF file is required' });
        if (!thumb)
            return res.status(400).json({ error: 'Thumbnail image is required' });
        if (pdf.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'Please upload a valid PDF file' });
        }
        if (!thumb.mimetype.startsWith('image/')) {
            return res.status(400).json({ error: 'Please upload a valid thumbnail image' });
        }
        if (thumb.size > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'Thumbnail size must be less than 5MB' });
        }
        let insert;
        try {
            insert = await db_1.pool.query('INSERT INTO pdf_documents (filename, mimetype, size, data) VALUES ($1, $2, $3, $4) RETURNING id', [pdf.originalname, pdf.mimetype, pdf.size, pdf.buffer]);
        }
        catch (e) {
            if (e?.code === '42P01') {
                return res.status(500).json({
                    error: 'Database table pdf_documents does not exist. Run drizzle/0001_pdf_documents.sql then retry.',
                });
            }
            throw e;
        }
        const documentId = insert.rows?.[0]?.id;
        if (!documentId)
            return res.status(500).json({ error: 'Failed to store PDF in database' });
        const thumbExt = path_1.default.extname(thumb.originalname || '') || '.png';
        const thumbFileName = safeFileName(thumb.originalname, thumbExt);
        let thumbBlob;
        try {
            thumbBlob = await (0, blob_1.put)(thumbFileName, thumb.buffer, { access: 'public' });
        }
        catch (blobError) {
            console.error('Thumbnail blob upload error:', blobError);
            return res.status(500).json({ error: `Failed to upload thumbnail: ${blobError.message}` });
        }
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const pdfUrl = `${baseUrl}/documents/${encodeURIComponent(documentId)}`;
        const thumbUrl = thumbBlob.url;
        req.body.imageUrl = `${pdfUrl}|${thumbUrl}`;
        req.body.caption = captionForDb;
        req.body.body = bodyForDb;
        return (0, postController_1.createPost)(req, res);
    }
    catch (error) {
        console.error('Post upload error:', error);
        return res.status(500).json({ error: error.message || 'Failed to create post' });
    }
});
router.post('/', postController_1.createPost);
router.get('/', postController_1.getPosts);
router.get('/:id', postController_1.getPostById);
router.put('/:id', postController_1.updatePost);
router.delete('/:id', postController_1.deletePost);
exports.default = router;
