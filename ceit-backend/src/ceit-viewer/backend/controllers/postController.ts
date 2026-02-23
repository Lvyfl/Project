import { Request, Response } from 'express';
import { db } from '../../../db';
import { posts, users, departments } from '../../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';

const MAX_LIST_MEDIA_BYTES = 20000;

const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;

const uploadsDir = path.join(__dirname, '../../../../uploads');
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

// Fast list: return URL-based media and small thumbnails; drop huge legacy base64 blobs to avoid timeouts.
const listImageUrl = sql<string>`
  CASE
    WHEN ${posts.imageUrl} IS NULL THEN ''
    WHEN octet_length(${posts.imageUrl}) > ${MAX_LIST_MEDIA_BYTES} THEN ''
    WHEN left(${posts.imageUrl}, 20) = 'data:application/pdf' THEN 'PDF_PLACEHOLDER|' || split_part(${posts.imageUrl}, '|', 2)
    ELSE ${posts.imageUrl}
  END
`;

const hasMedia = sql<boolean>`(${posts.imageUrl} is not null)`;

export const createPost = async (req: any, res: Response) => {
  try {
    const { caption } = req.body;
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

    const [newPost] = await db.insert(posts).values({
      caption,
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
        imageUrl: listImageUrl,
        hasMedia,
        createdAt: posts.createdAt,
        departmentId: posts.departmentId,
        adminId: posts.adminId,
      })
      .from(posts)
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
    const { caption } = req.body;
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
      .set({ caption, imageUrl })
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
    const { departmentId } = req.user;

    const deleted = await db
      .delete(posts)
      .where(and(eq(posts.id, id), eq(posts.departmentId, departmentId)))
      .returning({ id: posts.id });

    if (!deleted[0]) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get single post with full data (including full PDF base64)
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
        imageUrl: safeImageUrl,
        mediaTooLarge,
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

// Public endpoint - no authentication required
export const getPublicPosts = async (req: Request, res: Response) => {
  try {
    const { departmentId } = req.query;
    const rawLimit = parseInt(req.query.limit as string);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 30) : 20;
    const offset = parseInt(req.query.offset as string) || 0;

    let query = db
      .select({
        id: posts.id,
        caption: posts.caption,
        imageUrl: listImageUrl,
        hasMedia,
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

    if (departmentId && typeof departmentId === 'string') {
      const allPosts = await query.where(eq(posts.departmentId, departmentId));
      return res.json(allPosts);
    }

    const allPosts = await query;
    res.json(allPosts);
  } catch (error: any) {
    const detail = error?.cause?.message || error?.detail || '';
    const message = detail ? `${error.message} | ${detail}` : error.message;
    console.error('getPublicPosts error:', error);
    res.status(500).json({ error: message });
  }
};
