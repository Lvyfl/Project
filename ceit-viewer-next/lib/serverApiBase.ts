import { headers } from 'next/headers';

function trimSlash(s: string) {
  return s.replace(/\/$/, '');
}

/**
 * API base URL for Server Components (iframe src, etc.).
 * If NEXT_PUBLIC_API_URL points at this same deployment, use same-origin `/ceit-api` proxy.
 */
export async function getServerApiBase(): Promise<string> {
  const env = trimSlash((process.env.NEXT_PUBLIC_API_URL || '').trim());
  let here = '';
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto =
      (h.get('x-forwarded-proto') || 'https').split(',')[0]?.trim() || 'https';
    if (host) here = trimSlash(`${proto}://${host}`);
  } catch {
    /* headers() outside a request */
  }

  if (env && here) {
    try {
      const envUrl = env.startsWith('http://') || env.startsWith('https://') ? env : `https://${env}`;
      if (new URL(envUrl).origin === new URL(here).origin) {
        return `${here}/ceit-api`;
      }
    } catch {
      /* keep env */
    }
  }
  if (env) return env;
  if (here) return `${here}/ceit-api`;
  return 'http://localhost:3000';
}
