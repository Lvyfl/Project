"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPostEngagement = exports.trackPostView = exports.likePublicPost = exports.getPostDepartments = exports.getPostDepartmentCounts = exports.getPublicPosts = exports.getPostById = exports.deletePost = exports.updatePost = exports.getPosts = exports.createPost = void 0;
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const blob_1 = require("@vercel/blob");
/** Public list payload limit per post media field (legacy rows may store base64 or long JSON). */
const MAX_LIST_MEDIA_BYTES = 524288;
const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;
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
async function uploadImageBlob(buffer, ext) {
    const fileName = `post_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    const blob = await (0, blob_1.put)(fileName, buffer, { access: 'public' });
    return blob.url;
}
const listImageUrl = (0, drizzle_orm_1.sql) `
	CASE
		WHEN ${schema_1.posts.imageUrl} IS NULL THEN ''
		WHEN octet_length(${schema_1.posts.imageUrl}) > ${MAX_LIST_MEDIA_BYTES} THEN ''
		WHEN left(${schema_1.posts.imageUrl}, 20) = 'data:application/pdf' THEN 'PDF_PLACEHOLDER|' || split_part(${schema_1.posts.imageUrl}, '|', 2)
		ELSE ${schema_1.posts.imageUrl}
	END
`;
const hasMedia = (0, drizzle_orm_1.sql) `(${schema_1.posts.imageUrl} is not null)`;
const likesCount = (0, drizzle_orm_1.sql) `(
	SELECT COUNT(*)::int
	FROM ${schema_1.postLikes}
	WHERE ${schema_1.postLikes.postId} = ${schema_1.posts.id}
)`;
const createPost = async (req, res) => {
    try {
        const { caption, body, category } = req.body;
        let imageUrl = req.body?.imageUrl;
        const imageUrlsRaw = req.body?.imageUrls;
        const { userId, departmentId } = req.user;
        // Helper: save a single data URL to disk and return the file URL
        const processOne = async (url) => {
            if (typeof url === 'string' && url.startsWith('data:image/')) {
                const parsed = parseDataUrl(url);
                if (!parsed || !parsed.mime.startsWith('image/')) {
                    throw new Error('Invalid image data URL');
                }
                if (parsed.buffer.length > MAX_INLINE_IMAGE_BYTES) {
                    throw new Error('Image is too large. Please upload a smaller image.');
                }
                const ext = extFromMime(parsed.mime);
                return await uploadImageBlob(parsed.buffer, ext);
            }
            return url;
        };
        if (Array.isArray(imageUrlsRaw) && imageUrlsRaw.length > 0) {
            // Multiple images: process each, then store as JSON array if > 1 or single URL if exactly 1
            const processed = await Promise.all(imageUrlsRaw.map(processOne));
            imageUrl = processed.length === 1 ? processed[0] : JSON.stringify(processed);
        }
        else if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
            imageUrl = await processOne(imageUrl);
        }
        const [newPost] = await db_1.db.insert(schema_1.posts).values({
            caption,
            body: body || null,
            category: category || null,
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
            body: schema_1.posts.body,
            category: schema_1.posts.category,
            imageUrl: listImageUrl,
            hasMedia,
            likesCount,
            createdAt: schema_1.posts.createdAt,
            departmentId: schema_1.posts.departmentId,
            adminId: schema_1.posts.adminId,
            adminName: schema_1.users.name,
            departmentName: schema_1.departments.name,
        })
            .from(schema_1.posts)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.posts.adminId, schema_1.users.id))
            .leftJoin(schema_1.departments, (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, schema_1.departments.id))
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
        const { caption, body, category } = req.body;
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
            imageUrl = await uploadImageBlob(parsed.buffer, ext);
        }
        const updated = await db_1.db
            .update(schema_1.posts)
            .set({ caption, body: body !== undefined ? (body || null) : undefined, category: category !== undefined ? (category || null) : undefined, imageUrl })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.posts.id, id), (0, drizzle_orm_1.eq)(schema_1.posts.adminId, userId), (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, departmentId)))
            .returning({
            id: schema_1.posts.id,
            caption: schema_1.posts.caption,
            body: schema_1.posts.body,
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
        const { userId, departmentId } = req.user;
        const deleted = await db_1.db
            .delete(schema_1.posts)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.posts.id, id), (0, drizzle_orm_1.eq)(schema_1.posts.adminId, userId), (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, departmentId)))
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
            category: schema_1.posts.category,
            imageUrl: safeImageUrl,
            mediaTooLarge,
            likesCount,
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
function buildPublicMediaRewriter(req) {
    const reqBase = `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
    const rewriteOne = (url) => {
        if (!url)
            return '';
        if (url.startsWith('data:') || url.startsWith('blob:'))
            return url;
        let u = url.replace(/https?:\/\/localhost:\d+/gi, reqBase);
        u = u.replace(/https?:\/\/127\.0\.0\.1:\d+/gi, reqBase);
        if (u.startsWith('//'))
            return `${req.protocol}:${u}`;
        if (u.startsWith('/'))
            return `${reqBase}${u}`;
        if (!/^https?:\/\//i.test(u))
            return `${reqBase}/${u.replace(/^\//, '')}`;
        return u;
    };
    return (raw) => {
        if (raw == null || raw === '')
            return raw ?? '';
        if (raw.startsWith('[')) {
            try {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    return JSON.stringify(arr.map((item) => (typeof item === 'string' ? rewriteOne(item) : item)));
                }
            }
            catch {
                /* fall through */
            }
        }
        if (raw.startsWith('PDF_PLACEHOLDER|')) {
            const thumb = raw.slice('PDF_PLACEHOLDER|'.length);
            return `PDF_PLACEHOLDER|${rewriteOne(thumb)}`;
        }
        if (raw.includes('|')) {
            const i = raw.indexOf('|');
            const a = raw.slice(0, i);
            const b = raw.slice(i + 1);
            return `${rewriteOne(a)}|${rewriteOne(b)}`;
        }
        return rewriteOne(raw);
    };
}
const getPublicPosts = async (req, res) => {
    try {
        const { departmentId } = req.query;
        const rawLimit = parseInt(req.query.limit);
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 30) : 20;
        const offset = parseInt(req.query.offset) || 0;
        const rewriteMediaField = buildPublicMediaRewriter(req);
        const query = db_1.db
            .select({
            id: schema_1.posts.id,
            caption: schema_1.posts.caption,
            body: schema_1.posts.body,
            category: schema_1.posts.category,
            imageUrl: listImageUrl,
            hasMedia,
            likesCount,
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
        const mapPost = (p) => ({
            ...p,
            imageUrl: rewriteMediaField(p.imageUrl),
        });
        if (departmentId && typeof departmentId === 'string') {
            const allPosts = await query.where((0, drizzle_orm_1.eq)(schema_1.posts.departmentId, departmentId));
            return res.json(allPosts.map(mapPost));
        }
        const allPosts = await query;
        res.json(allPosts.map(mapPost));
    }
    catch (error) {
        const detail = error?.cause?.message || error?.detail || '';
        const message = detail ? `${error.message} | ${detail}` : error.message;
        console.error('getPublicPosts error:', error);
        res.status(500).json({ error: message });
    }
};
exports.getPublicPosts = getPublicPosts;
const getPostDepartmentCounts = async (_req, res) => {
    try {
        const rows = await db_1.db
            .select({
            departmentName: schema_1.departments.name,
            count: (0, drizzle_orm_1.sql) `cast(count(${schema_1.posts.id}) as int)`,
        })
            .from(schema_1.posts)
            .innerJoin(schema_1.departments, (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, schema_1.departments.id))
            .groupBy(schema_1.departments.name)
            .orderBy((0, drizzle_orm_1.desc)((0, drizzle_orm_1.sql) `count(${schema_1.posts.id})`));
        res.json(rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPostDepartmentCounts = getPostDepartmentCounts;
const getPostDepartments = async (_req, res) => {
    try {
        // Only return departments that actually have at least one post.
        // Inner join ensures no dept without posts is returned, and
        // selectDistinct deduplicates in case of duplicate dept rows.
        const rows = await db_1.db
            .selectDistinct({ id: schema_1.departments.id, name: schema_1.departments.name })
            .from(schema_1.posts)
            .innerJoin(schema_1.departments, (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, schema_1.departments.id))
            .orderBy((0, drizzle_orm_1.asc)(schema_1.departments.name));
        res.json(rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPostDepartments = getPostDepartments;
const likePublicPost = async (req, res) => {
    try {
        const postId = String(req.params.id || '').trim();
        const clientKey = String(req.body?.clientKey || '').trim();
        if (!postId)
            return res.status(400).json({ error: 'Post id is required' });
        if (!clientKey)
            return res.status(400).json({ error: 'clientKey is required' });
        const [post] = await db_1.db.select({ id: schema_1.posts.id }).from(schema_1.posts).where((0, drizzle_orm_1.eq)(schema_1.posts.id, postId));
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        await db_1.db
            .insert(schema_1.postLikes)
            .values({ postId, clientKey })
            .onConflictDoNothing();
        const [row] = await db_1.db
            .select({ likesCount })
            .from(schema_1.posts)
            .where((0, drizzle_orm_1.eq)(schema_1.posts.id, postId));
        return res.status(200).json({ likesCount: row?.likesCount ?? 0 });
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to like post' });
    }
};
exports.likePublicPost = likePublicPost;
const trackPostView = async (req, res) => {
    try {
        const postId = String(req.params.id || '').trim();
        const clientKey = String(req.body?.clientKey || '').trim();
        if (!postId)
            return res.status(400).json({ error: 'Post id is required' });
        if (!clientKey)
            return res.status(400).json({ error: 'clientKey is required' });
        const [post] = await db_1.db.select({ id: schema_1.posts.id }).from(schema_1.posts).where((0, drizzle_orm_1.eq)(schema_1.posts.id, postId));
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        await db_1.db.insert(schema_1.postViews).values({ postId, clientKey });
        return res.status(200).json({ ok: true });
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to track view' });
    }
};
exports.trackPostView = trackPostView;
const getPostEngagement = async (req, res) => {
    try {
        const viewsCount = (0, drizzle_orm_1.sql) `cast(count(${schema_1.postViews.id}) as int)`;
        const rows = await db_1.db
            .select({
            id: schema_1.posts.id,
            caption: schema_1.posts.caption,
            departmentName: schema_1.departments.name,
            viewCount: viewsCount,
        })
            .from(schema_1.posts)
            .leftJoin(schema_1.postViews, (0, drizzle_orm_1.eq)(schema_1.postViews.postId, schema_1.posts.id))
            .leftJoin(schema_1.departments, (0, drizzle_orm_1.eq)(schema_1.posts.departmentId, schema_1.departments.id))
            .groupBy(schema_1.posts.id, schema_1.posts.caption, schema_1.departments.name)
            .orderBy((0, drizzle_orm_1.desc)(viewsCount))
            .limit(10);
        const totalViews = rows.reduce((sum, r) => sum + r.viewCount, 0);
        res.json({ totalViews, posts: rows });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPostEngagement = getPostEngagement;
