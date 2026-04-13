import { Request, Response } from 'express';
import { db } from '../db';
import { posts, users, departments, postLikes, postViews } from '../db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';

const MAX_LIST_MEDIA_BYTES = 20000;
const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

function parseDataUrl(dataUrl: string) {
	const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
	if (!m) return null;
	const mime = m[1];
	const b64 = m[2];
	try {
		const buffer = Buffer.from(b64, 'base64');
		return { mime, buffer };
	} catch {
		return null;
	}
}

function extFromMime(mime: string) {
	const m = mime.toLowerCase();
	if (m === 'image/jpeg') return 'jpg';
	if (m === 'image/png') return 'png';
	if (m === 'image/webp') return 'webp';
	if (m === 'image/gif') return 'gif';
	return 'bin';
}

async function writeUpload(buffer: Buffer, ext: string) {
	const fileName = `post_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
	const fullPath = path.join(uploadsDir, fileName);
	await fsp.writeFile(fullPath, buffer);
	return fileName;
}

const listImageUrl = sql<string>`
	CASE
		WHEN ${posts.imageUrl} IS NULL THEN ''
		WHEN octet_length(${posts.imageUrl}) > ${MAX_LIST_MEDIA_BYTES} THEN ''
		WHEN left(${posts.imageUrl}, 20) = 'data:application/pdf' THEN 'PDF_PLACEHOLDER|' || split_part(${posts.imageUrl}, '|', 2)
		ELSE ${posts.imageUrl}
	END
`;

const hasMedia = sql<boolean>`(${posts.imageUrl} is not null)`;
const likesCount = sql<number>`(
	SELECT COUNT(*)::int
	FROM ${postLikes}
	WHERE ${postLikes.postId} = ${posts.id}
)`;

export const createPost = async (req: any, res: Response) => {
	try {
		const { caption, body, category } = req.body;
		let imageUrl: string | undefined = req.body?.imageUrl;
		const imageUrlsRaw: unknown = req.body?.imageUrls;
		const { userId, departmentId } = req.user;

		// Helper: save a single data URL to disk and return the file URL
		const processOne = async (url: string): Promise<string> => {
			if (typeof url === 'string' && url.startsWith('data:image/')) {
				const parsed = parseDataUrl(url);
				if (!parsed || !parsed.mime.startsWith('image/')) {
					throw new Error('Invalid image data URL');
				}
				if (parsed.buffer.length > MAX_INLINE_IMAGE_BYTES) {
					throw new Error('Image is too large. Please upload a smaller image.');
				}
				const ext = extFromMime(parsed.mime);
				const file = await writeUpload(parsed.buffer, ext);
				const baseUrl = `${req.protocol}://${req.get('host')}`;
				return `${baseUrl}/uploads/${encodeURIComponent(file)}`;
			}
			return url;
		};

		if (Array.isArray(imageUrlsRaw) && imageUrlsRaw.length > 0) {
			// Multiple images: process each, then store as JSON array if > 1 or single URL if exactly 1
			const processed = await Promise.all((imageUrlsRaw as string[]).map(processOne));
			imageUrl = processed.length === 1 ? processed[0] : JSON.stringify(processed);
		} else if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
			imageUrl = await processOne(imageUrl);
		}

		const [newPost] = await db.insert(posts).values({
			caption,
			body: body || null,
			category: category || null,
			imageUrl,
			adminId: userId,
			departmentId: departmentId,
		}).returning();

		res.status(201).json(newPost);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
};

export const getPosts = async (req: any, res: Response) => {
	try {
		const { departmentId } = req.user;
		const rawLimit = parseInt(req.query.limit as string);
		const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 30) : 20;
		const offset = parseInt(req.query.offset as string) || 0;

		const departmentPosts = await db
			.select({
				id: posts.id,
				caption: posts.caption,
				body: posts.body,
				category: posts.category,
				imageUrl: listImageUrl,
				hasMedia,
				likesCount,
				createdAt: posts.createdAt,
				departmentId: posts.departmentId,
				adminId: posts.adminId,
				adminName: users.name,
				departmentName: departments.name,
			})
			.from(posts)
			.leftJoin(users, eq(posts.adminId, users.id))
			.leftJoin(departments, eq(posts.departmentId, departments.id))
			.where(eq(posts.departmentId, departmentId))
			.orderBy(desc(posts.createdAt))
			.limit(limit)
			.offset(offset);

		res.json(departmentPosts);
	} catch (error: any) {
		const detail = error?.cause?.message || error?.detail || '';
		const message = detail ? `${error.message} | ${detail}` : error.message;
		console.error('getPosts error:', error);
		res.status(500).json({ error: message });
	}
};

export const updatePost = async (req: any, res: Response) => {
	try {
		const { id } = req.params;
		const { caption, body, category } = req.body;
		let imageUrl: string | undefined = req.body?.imageUrl;
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

		const updated = await db
			.update(posts)
			.set({ caption, body: body !== undefined ? (body || null) : undefined, category: category !== undefined ? (category || null) : undefined, imageUrl })
			.where(
				and(
					eq(posts.id, id),
					eq(posts.adminId, userId),
					eq(posts.departmentId, departmentId)
				)
			)
			.returning({
				id: posts.id,
				caption: posts.caption,
				body: posts.body,
				imageUrl: posts.imageUrl,
				createdAt: posts.createdAt,
				departmentId: posts.departmentId,
				adminId: posts.adminId,
			});

		if (!updated[0]) {
			return res.status(404).json({ error: 'Post not found or unauthorized' });
		}

		res.json(updated[0]);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
};

export const deletePost = async (req: any, res: Response) => {
	try {
		const { id } = req.params;
		const { userId, departmentId } = req.user;

		const deleted = await db
			.delete(posts)
			.where(
				and(
					eq(posts.id, id),
					eq(posts.adminId, userId),
					eq(posts.departmentId, departmentId)
				)
			)
			.returning({ id: posts.id });

		if (!deleted[0]) {
			return res.status(404).json({ error: 'Post not found or unauthorized' });
		}

		res.json({ message: 'Post deleted successfully' });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
};

export const getPostById = async (req: Request, res: Response) => {
	try {
		const id = req.params.id as string;

		const safeImageUrl = sql<string>`
			CASE
				WHEN ${posts.imageUrl} IS NULL THEN ''
				WHEN octet_length(${posts.imageUrl}) > 2000000 THEN ''
				ELSE ${posts.imageUrl}
			END
		`;
		const mediaTooLarge = sql<boolean>`(octet_length(${posts.imageUrl}) > 2000000)`;

		const [post] = await db
			.select({
				id: posts.id,
				caption: posts.caption,
				category: posts.category,
				imageUrl: safeImageUrl,
				mediaTooLarge,
				likesCount,
				createdAt: posts.createdAt,
				adminName: users.name,
				departmentName: departments.name,
				departmentId: posts.departmentId,
			})
			.from(posts)
			.leftJoin(users, eq(posts.adminId, users.id))
			.leftJoin(departments, eq(posts.departmentId, departments.id))
			.where(eq(posts.id, id));

		if (!post) {
			return res.status(404).json({ error: 'Post not found' });
		}
		res.json(post);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
};

export const getPublicPosts = async (req: Request, res: Response) => {
	try {
		const { departmentId } = req.query;
		const rawLimit = parseInt(req.query.limit as string);
		const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 30) : 20;
		const offset = parseInt(req.query.offset as string) || 0;

		const reqBase = `${req.protocol}://${req.get('host')}`;

		const rewriteUrl = (url: string | null | undefined): string => {
			if (!url) return url ?? '';
			// Replace any stored localhost:PORT that differs from current server
			return url.replace(/https?:\/\/localhost:\d+/g, reqBase);
		};

		const query = db
			.select({
				id: posts.id,
				caption: posts.caption,
				body: posts.body,
				category: posts.category,
				imageUrl: listImageUrl,
				hasMedia,
				likesCount,
				createdAt: posts.createdAt,
				adminName: users.name,
				departmentName: departments.name,
				departmentId: posts.departmentId,
			})
			.from(posts)
			.leftJoin(users, eq(posts.adminId, users.id))
			.leftJoin(departments, eq(posts.departmentId, departments.id))
			.orderBy(desc(posts.createdAt))
			.limit(limit)
			.offset(offset);

		const mapPost = (p: { imageUrl: string | null; [key: string]: unknown }) => ({ ...p, imageUrl: rewriteUrl(p.imageUrl) });

		if (departmentId && typeof departmentId === 'string') {
			const allPosts = await query.where(eq(posts.departmentId, departmentId));
			return res.json(allPosts.map(mapPost));
		}

		const allPosts = await query;
		res.json(allPosts.map(mapPost));
	} catch (error: any) {
		const detail = error?.cause?.message || error?.detail || '';
		const message = detail ? `${error.message} | ${detail}` : error.message;
		console.error('getPublicPosts error:', error);
		res.status(500).json({ error: message });
	}
};

export const getPostDepartmentCounts = async (_req: Request, res: Response) => {
	try {
		const rows = await db
			.select({
				departmentName: departments.name,
				count: sql<number>`cast(count(${posts.id}) as int)`,
			})
			.from(posts)
			.innerJoin(departments, eq(posts.departmentId, departments.id))
			.groupBy(departments.name)
			.orderBy(desc(sql`count(${posts.id})`));
		res.json(rows);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
};

export const getPostDepartments = async (_req: Request, res: Response) => {
	try {
		// Only return departments that actually have at least one post.
		// Inner join ensures no dept without posts is returned, and
		// selectDistinct deduplicates in case of duplicate dept rows.
		const rows = await db
			.selectDistinct({ id: departments.id, name: departments.name })
			.from(posts)
			.innerJoin(departments, eq(posts.departmentId, departments.id))
			.orderBy(asc(departments.name));
		res.json(rows);
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
};

export const likePublicPost = async (req: Request, res: Response) => {
	try {
		const postId = String(req.params.id || '').trim();
		const clientKey = String((req.body as any)?.clientKey || '').trim();

		if (!postId) return res.status(400).json({ error: 'Post id is required' });
		if (!clientKey) return res.status(400).json({ error: 'clientKey is required' });

		const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId));
		if (!post) return res.status(404).json({ error: 'Post not found' });

		await db
			.insert(postLikes)
			.values({ postId, clientKey })
			.onConflictDoNothing();

		const [row] = await db
			.select({ likesCount })
			.from(posts)
			.where(eq(posts.id, postId));

		return res.status(200).json({ likesCount: row?.likesCount ?? 0 });
	} catch (error: any) {
		return res.status(500).json({ error: error.message || 'Failed to like post' });
	}
};

export const trackPostView = async (req: Request, res: Response) => {
	try {
		const postId = String(req.params.id || '').trim();
		const clientKey = String((req.body as any)?.clientKey || '').trim();

		if (!postId) return res.status(400).json({ error: 'Post id is required' });
		if (!clientKey) return res.status(400).json({ error: 'clientKey is required' });

		const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId));
		if (!post) return res.status(404).json({ error: 'Post not found' });

		await db.insert(postViews).values({ postId, clientKey });

		return res.status(200).json({ ok: true });
	} catch (error: any) {
		return res.status(500).json({ error: error.message || 'Failed to track view' });
	}
};

export const getPostEngagement = async (req: any, res: Response) => {
	try {
		const viewsCount = sql<number>`cast(count(${postViews.id}) as int)`;

		const rows = await db
			.select({
				id: posts.id,
				caption: posts.caption,
				departmentName: departments.name,
				viewCount: viewsCount,
			})
			.from(posts)
			.leftJoin(postViews, eq(postViews.postId, posts.id))
			.leftJoin(departments, eq(posts.departmentId, departments.id))
			.groupBy(posts.id, posts.caption, departments.name)
			.orderBy(desc(viewsCount))
			.limit(10);

		const totalViews = rows.reduce((sum, r) => sum + r.viewCount, 0);
		res.json({ totalViews, posts: rows });
	} catch (error: any) {
		res.status(500).json({ error: error.message });
	}
};
