"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicPosts = exports.getPostById = exports.deletePost = exports.updatePost = exports.getPosts = exports.createPost = void 0;
const db_1 = require("../../../db");
const schema_1 = require("../../../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const fs_2 = require("fs");
const MAX_LIST_MEDIA_BYTES = 20000;
const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;
const uploadsDir = path_1.default.join(__dirname, '../../../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
function parseDataUrl(dataUrl) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
    if (!m)
        return null;
    const mime = m[1];
    const b64 = m[2];
    try {
        const buffer = Buffer.from(b64, 'base64');
        return { mime, buffer };
    }
    catch {
        return null;
    }
}
function extFromMime(mime) {
    const m = mime.toLowerCase();
    if (m === 'image/jpeg')
        return 'jpg';
    if (m === 'image/png')
        return 'png';
    if (m === 'image/webp')
        return 'webp';
    if (m === 'image/gif')
        return 'gif';
    return 'bin';
}
async function writeUpload(buffer, ext) {
    const fileName = `post_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    const fullPath = path_1.default.join(uploadsDir, fileName);
    await fs_2.promises.writeFile(fullPath, buffer);
    return fileName;
}
// Fast list: return URL-based media and small thumbnails; drop huge legacy base64 blobs to avoid timeouts.
const listImageUrl = (0, drizzle_orm_1.sql) `
  CASE
    WHEN ${schema_1.posts.imageUrl} IS NULL THEN ''
    WHEN octet_length(${schema_1.posts.imageUrl}) > ${MAX_LIST_MEDIA_BYTES} THEN ''
    WHEN left(${schema_1.posts.imageUrl}, 20) = 'data:application/pdf' THEN 'PDF_PLACEHOLDER|' || split_part(${schema_1.posts.imageUrl}, '|', 2)
    ELSE ${schema_1.posts.imageUrl}
  END
`;
const hasMedia = (0, drizzle_orm_1.sql) `(${schema_1.posts.imageUrl} is not null)`;
const createPost = async (req, res) => {
    try {
        const { caption } = req.body;
        let imageUrl = req.body?.imageUrl;
        const { userId, departmentId } = req.user;
        if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
            const parsed = parseDataUrl(imageUrl);
            if (!parsed || !parsed.mime.startsWith('image/')) {
                return res.status(400).json({ error: 'Invalid image data URL' });
            }
            if (parsed.buffer.length > MAX_INLINE_IMAGE_BYTES) {
                return res.status(413).json({ error: 'Image is too large. Please upload a smaller image.' });
            }
            const ext = extFromMime(parsed.mime);
            const file = await writeUpload(parsed.buffer, ext);
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            imageUrl = `${baseUrl}/uploads/${encodeURIComponent(file)}`;
        }
        const [newPost] = await db_1.db.insert(schema_1.posts).values({
            caption,
            imageUrl,
            adminId: userId,
            departmentId: departmentId,
        }).returning();
        res.status(201).json(newPost);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createPost = createPost;
const getPosts = async (req, res) => {
    try {
        const { departmentId } = req.user;
        const rawLimit = parseInt(req.query.limit);
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 30) : 20;
        const offset = parseInt(req.query.offset) || 0;
        const departmentPosts = await db_1.db
            .select({
            id: schema_1.posts.id,
            caption: schema_1.posts.caption,
            imageUrl: listImageUrl,
            hasMedia,
            createdAt: schema_1.posts.createdAt,
            departmentId: schema_1.posts.departmentId,
            adminId: schema_1.posts.adminId,
        })
            .from(schema_1.posts)
            .where((0, drizzle_orm_1.eq)(schema_1.posts.departmentId, departmentId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.posts.createdAt))
            .limit(limit)
            .offset(offset);
        res.json(departmentPosts);
    }
    catch (error) {
        const detail = error?.cause?.message || error?.detail || '';
        const message = detail ? `${error.message} | ${detail}` : error.message;
        console.error('getPosts error:', error);
        res.status(500).json({ error: message });
    }
};
exports.getPosts = getPosts;
const updatePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { caption } = req.body;
        let imageUrl = req.body?.imageUrl;
        const { userId, departmentId } = req.user;
        if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
            const parsed = parseDataUrl(imageUrl);
            if (!parsed || !parsed.mime.startsWith('image/')) {
                return res.status(400).json({ error: 'Invalid image data URL' });
            }
            if (parsed.buffer.length > MAX_INLINE_IMAGE_BYTES) {
                return res.status(413).json({ error: 'Image is too large. Please upload a smaller image.' });
            }
            const ext = extFromMime(parsed.mime);
            const file = await writeUpload(parsed.buffer, ext);
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            imageUrl = `${baseUrl}/uploads/${encodeURIComponent(file)}`;
        }
        const updated = await db_1.db
            .update(schema_1.posts)
            .set({ caption, imageUrl })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.posts.id, id), (0, drizzle_orm_1.eq)(schema_1.posts.adminId, userId), (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, departmentId)))
            .returning({
            id: schema_1.posts.id,
            caption: schema_1.posts.caption,
            imageUrl: schema_1.posts.imageUrl,
            createdAt: schema_1.posts.createdAt,
            departmentId: schema_1.posts.departmentId,
            adminId: schema_1.posts.adminId,
        });
        if (!updated[0]) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }
        res.json(updated[0]);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updatePost = updatePost;
const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const { departmentId } = req.user;
        const deleted = await db_1.db
            .delete(schema_1.posts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.posts.id, id), (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, departmentId)))
            .returning({ id: schema_1.posts.id });
        if (!deleted[0]) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }
        res.json({ message: 'Post deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deletePost = deletePost;
// Get single post with full data (including full PDF base64)
const getPostById = async (req, res) => {
    try {
        const id = req.params.id;
        const safeImageUrl = (0, drizzle_orm_1.sql) `
      CASE
        WHEN ${schema_1.posts.imageUrl} IS NULL THEN ''
        WHEN octet_length(${schema_1.posts.imageUrl}) > 2000000 THEN ''
        ELSE ${schema_1.posts.imageUrl}
      END
    `;
        const mediaTooLarge = (0, drizzle_orm_1.sql) `(octet_length(${schema_1.posts.imageUrl}) > 2000000)`;
        const [post] = await db_1.db
            .select({
            id: schema_1.posts.id,
            caption: schema_1.posts.caption,
            imageUrl: safeImageUrl,
            mediaTooLarge,
            createdAt: schema_1.posts.createdAt,
            adminName: schema_1.users.name,
            departmentName: schema_1.departments.name,
            departmentId: schema_1.posts.departmentId,
        })
            .from(schema_1.posts)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.posts.adminId, schema_1.users.id))
            .leftJoin(schema_1.departments, (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, schema_1.departments.id))
            .where((0, drizzle_orm_1.eq)(schema_1.posts.id, id));
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(post);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPostById = getPostById;
// Public endpoint - no authentication required
const getPublicPosts = async (req, res) => {
    try {
        const { departmentId } = req.query;
        const rawLimit = parseInt(req.query.limit);
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 30) : 20;
        const offset = parseInt(req.query.offset) || 0;
        let query = db_1.db
            .select({
            id: schema_1.posts.id,
            caption: schema_1.posts.caption,
            imageUrl: listImageUrl,
            hasMedia,
            createdAt: schema_1.posts.createdAt,
            adminName: schema_1.users.name,
            departmentName: schema_1.departments.name,
            departmentId: schema_1.posts.departmentId,
        })
            .from(schema_1.posts)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.posts.adminId, schema_1.users.id))
            .leftJoin(schema_1.departments, (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, schema_1.departments.id))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.posts.createdAt))
            .limit(limit)
            .offset(offset);
        if (departmentId && typeof departmentId === 'string') {
            const allPosts = await query.where((0, drizzle_orm_1.eq)(schema_1.posts.departmentId, departmentId));
            return res.json(allPosts);
        }
        const allPosts = await query;
        res.json(allPosts);
    }
    catch (error) {
        const detail = error?.cause?.message || error?.detail || '';
        const message = detail ? `${error.message} | ${detail}` : error.message;
        console.error('getPublicPosts error:', error);
        res.status(500).json({ error: message });
    }
};
exports.getPublicPosts = getPublicPosts;
