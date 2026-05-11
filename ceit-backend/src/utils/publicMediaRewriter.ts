import type { Request } from 'express';

function trimTrailingSlash(s: string) {
	return s.replace(/\/$/, '');
}

/**
 * Canonical public base URL for rewriting stored media (behind Render proxy, etc.).
 * Set PUBLIC_API_BASE on Render if needed; RENDER_EXTERNAL_URL is set by Render.
 */
export function getPublicApiBase(req: Request): string {
	const raw = (process.env.PUBLIC_API_BASE || process.env.RENDER_EXTERNAL_URL || '').trim();
	if (raw) {
		const withProto =
			raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
		return trimTrailingSlash(withProto);
	}
	const host = req.get('host') || 'localhost';
	const proto = (req.get('x-forwarded-proto') as string)?.split(',')[0]?.trim() || req.protocol;
	const safeProto = proto === 'https' || proto === 'http' ? proto : 'https';
	return trimTrailingSlash(`${safeProto}://${host}`);
}

/**
 * Rewrites stored media strings for public JSON (posts, backgrounds, etc.).
 */
export function buildPublicMediaRewriter(req: Request) {
	const reqBase = getPublicApiBase(req);
	const rewriteOne = (url: string): string => {
		if (!url) return '';
		if (url.startsWith('data:') || url.startsWith('blob:')) return url;
		let u = url.replace(/https?:\/\/localhost:\d+/gi, reqBase);
		u = u.replace(/https?:\/\/127\.0\.0\.1:\d+/gi, reqBase);
		if (u.startsWith('//')) return `${reqBase.startsWith('https') ? 'https' : 'http'}:${u}`;
		if (u.startsWith('/')) return `${reqBase}${u}`;
		if (!/^https?:\/\//i.test(u)) return `${reqBase}/${u.replace(/^\//, '')}`;
		try {
			const parsed = new URL(u);
			if (parsed.pathname.startsWith('/uploads/')) {
				return `${reqBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
			}
		} catch {
			/* keep u */
		}
		return u;
	};
	return (raw: string | null | undefined): string => {
		if (raw == null || raw === '') return raw ?? '';
		if (raw.startsWith('[')) {
			try {
				const arr = JSON.parse(raw) as unknown;
				if (Array.isArray(arr)) {
					return JSON.stringify(
						arr.map((item) => (typeof item === 'string' ? rewriteOne(item) : item)),
					);
				}
			} catch {
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
