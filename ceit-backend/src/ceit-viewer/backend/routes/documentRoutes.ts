import { Router } from 'express';
import multer from 'multer';
import { pool } from '../../../db';
import { authenticateToken } from '../../../middleware/authMiddleware';
import fs from 'fs';
import path from 'path';

const router = Router();

const pdfCacheDir = path.join(__dirname, '../../../../uploads/pdf-cache');
if (!fs.existsSync(pdfCacheDir)) {
  fs.mkdirSync(pdfCacheDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
});

// Upload PDF (protected)
router.post('/upload', authenticateToken, upload.single('pdfFile'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'PDF file is required' });
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Please upload a valid PDF file' });
    }

    const result = await pool.query(
      'INSERT INTO pdf_documents (filename, mimetype, size, data) VALUES ($1, $2, $3, $4) RETURNING id, filename, mimetype, size, created_at',
      [file.originalname, file.mimetype, file.size, file.buffer]
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

// Retrieve PDF by ID (public)
router.get('/:id/meta', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Document id is required' });

    const result = await pool.query(
      'SELECT id, filename, mimetype, size, created_at FROM pdf_documents WHERE id = $1',
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

    // Fast path: serve from local cache if available.
    const cachedPath = path.join(pdfCacheDir, `${id}.pdf`);
    if (fs.existsSync(cachedPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      return fs.createReadStream(cachedPath).pipe(res);
    }

    // Fetch metadata first (fast), then stream the BYTEA in small chunks.
    const meta = await pool.query(
      'SELECT filename, mimetype, size FROM pdf_documents WHERE id = $1',
      [id]
    );

    if (meta.rows.length === 0) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const doc = meta.rows[0] as { filename: string; mimetype: string; size: number };

    const safeName = String(doc.filename || 'document.pdf')
      .replace(/\r|\n/g, ' ')
      .replace(/"/g, "'")
      .slice(0, 180);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    if (typeof doc.size === 'number' && doc.size >= 0) {
      res.setHeader('Content-Length', String(doc.size));
    }

    (res as any).flushHeaders?.();
    res.status(200);

    const tmpPath = path.join(pdfCacheDir, `${id}.tmp`);
    const cacheStream = fs.createWriteStream(tmpPath);
    const cleanupTemp = async () => {
      try {
        cacheStream.close();
      } catch {
        // ignore
      }
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
    };

    res.on('close', () => {
      // client disconnected
      cleanupTemp();
    });

    const CHUNK_SIZE = 1024 * 1024; // 1MB
    const total = Math.max(0, Number(doc.size) || 0);

    for (let offset = 1; offset <= total; offset += CHUNK_SIZE) {
      const len = Math.min(CHUNK_SIZE, total - offset + 1);
      const chunkRes = await pool.query(
        'SELECT substring(data from $2 for $3) AS chunk FROM pdf_documents WHERE id = $1',
        [id, offset, len]
      );
      const chunkVal = chunkRes.rows?.[0]?.chunk as unknown;
      let chunk: Buffer;
      if (Buffer.isBuffer(chunkVal)) {
        chunk = chunkVal;
      } else if (typeof chunkVal === 'string') {
        chunk = chunkVal.startsWith('\\x') ? Buffer.from(chunkVal.slice(2), 'hex') : Buffer.from(chunkVal, 'binary');
      } else {
        return res.end();
      }
      if (chunk.length > 0) {
        cacheStream.write(chunk);
        const ok = res.write(chunk);
        if (!ok) {
          await new Promise<void>((resolve) => res.once('drain', () => resolve()));
        }
      }
    }

    cacheStream.end();
    try {
      fs.renameSync(tmpPath, cachedPath);
    } catch {
      // ignore cache rename failures
    }
    return res.end();
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
