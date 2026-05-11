/**
 * Shared utilities for ceit-viewer-next.
 */

import {
  shouldProxyInsteadOfPublicApiUrl,
  trimApiBaseSlash,
} from './apiBasePolicy';

/**
 * Base URL for JSON/API fetches from the browser.
 * - Uses NEXT_PUBLIC_API_URL when it is a non-Vercel host and differs from the viewer (e.g. Railway).
 * - Never follows NEXT_PUBLIC_API_URL to another *.vercel.app (usually another Next viewer) — uses
 *   same-origin `/api/ceit` proxy (see app/api/ceit/[[...path]]/route.ts + BACKEND_URL on the server).
 * - Opt out: NEXT_PUBLIC_TRUST_VERCEL_API_URL=1 if your API truly lives on vercel.app.
 */
export function getApiBase(): string {
  const env = trimApiBaseSlash((process.env.NEXT_PUBLIC_API_URL || '').trim());

  if (typeof window !== 'undefined') {
    const here = window.location.origin;
    if (env && shouldProxyInsteadOfPublicApiUrl(env)) {
      return `${here}/api/ceit`;
    }
    if (env) {
      try {
        const envUrl =
          env.startsWith('http://') || env.startsWith('https://') ? env : `https://${env}`;
        if (new URL(envUrl).origin !== new URL(here).origin) {
          return env;
        }
      } catch {
        return env;
      }
    }
    return `${here}/api/ceit`;
  }

  if (env) return env;
  return 'http://localhost:3000';
}

/** @deprecated Prefer getApiBase() in client code — module-level URL is wrong after hydration when using /api/ceit. */
export const API_BASE =
  trimApiBaseSlash((process.env.NEXT_PUBLIC_API_URL || '').trim()) || 'http://localhost:3000';

function isPrivateOrLocalHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') return true;
  if (h.endsWith('.local')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

function isVercelBlobHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h.endsWith('.public.blob.vercel-storage.com') || h.endsWith('.blob.vercel-storage.com');
}

/**
 * Turn API-relative or root-relative media paths into absolute URLs the browser can load.
 * Next.js runs on a different origin than the API, so `/uploads/...` must target the API host.
 */
export function resolveApiMediaUrl(url: string, apiBase: string): string {
  const base = apiBase.replace(/\/$/, '');
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('//')) {
    const proto = base.startsWith('https') ? 'https:' : 'http:';
    return `${proto}${url}`;
  }
  if (url.startsWith('/')) return `${base}${url}`;
  if (/^https?:\/\//i.test(url)) {
    try {
      const p = new URL(url);
      const host = p.hostname.toLowerCase();
      // XAMPP / LAN / localhost: prefer path from /uploads/ onward; otherwise remap full path to current API.
      if (isPrivateOrLocalHostname(host)) {
        const up = p.pathname.indexOf('/uploads/');
        if (up >= 0) {
          return `${base}${p.pathname.slice(up)}${p.search}${p.hash}`;
        }
        return `${base}${p.pathname}${p.search}${p.hash}`;
      }
      // Re-home /uploads/ only when not on Vercel Blob — blob object keys can legally contain "/uploads/" in the path.
      if (!isVercelBlobHostname(host) && p.pathname.startsWith('/uploads/')) {
        return `${base}${p.pathname}${p.search}${p.hash}`;
      }
    } catch {
      /* fall through */
    }
    return url;
  }
  return `${base}/${url.replace(/^\//, '')}`;
}

/**
 * Parse a post's imageUrl field into an array of display URLs.
 * - JSON array  → multiple images
 * - "pdf|thumb" → PDF post; returns only the thumbnail URL
 * - plain .pdf / data URI → returns empty array (no displayable image)
 * - plain URL   → single-element array
 */
export function parsePostImageUrls(imageUrl?: string | null): string[] {
  if (!imageUrl) return [];
  if (imageUrl.startsWith('[')) {
    try {
      return JSON.parse(imageUrl) as string[];
    } catch {
      // fall through
    }
  }
  if (imageUrl.includes('|')) {
    const thumb = imageUrl.split('|')[1];
    return thumb ? [thumb] : [];
  }
  if (
    imageUrl.toLowerCase().endsWith('.pdf') ||
    imageUrl.startsWith('data:application/pdf')
  ) {
    return [];
  }
  return [imageUrl];
}

/**
 * Detect and parse a PDF post imageUrl.
 * Returns isPdf=false for non-PDF posts (viewer variant keeps the URL in pdfUrl).
 */
export function parsePdfPost(imageUrl?: string): {
  isPdf: boolean;
  pdfUrl: string;
  thumbnailUrl: string;
} {
  if (!imageUrl) return { isPdf: false, pdfUrl: '', thumbnailUrl: '' };
  if (imageUrl.startsWith('[')) return { isPdf: false, pdfUrl: '', thumbnailUrl: '' };
  if (imageUrl.includes('|')) {
    const [pdf, thumb] = imageUrl.split('|');
    return { isPdf: true, pdfUrl: pdf, thumbnailUrl: thumb || '' };
  }
  if (
    imageUrl.toLowerCase().endsWith('.pdf') ||
    imageUrl.startsWith('data:application/pdf')
  ) {
    return { isPdf: true, pdfUrl: imageUrl, thumbnailUrl: '' };
  }
  return { isPdf: false, pdfUrl: '', thumbnailUrl: '' };
}
