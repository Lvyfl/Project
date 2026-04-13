/**
 * Shared utilities for ceit-viewer-next.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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
