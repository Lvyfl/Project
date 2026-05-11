/**
 * Heuristics for choosing API base URL on Vercel vs a real Express host.
 */

export function trimApiBaseSlash(s: string) {
  return s.replace(/\/$/, '');
}

/** Host is a Vercel deployment (*.vercel.app). Express in this stack is almost never here. */
export function isVercelDeploymentHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'vercel.app' || h.endsWith('.vercel.app');
}

/**
 * When true, NEXT_PUBLIC_API_URL must not be used as the direct API origin — use same-origin /api/ceit proxy.
 * Prevents: production viewer on ceit-*.vercel.app but env points at announcement-*.vercel.app (another Next app).
 */
export function shouldProxyInsteadOfPublicApiUrl(env: string): boolean {
  if (!env.trim()) return false;
  if (process.env.NEXT_PUBLIC_TRUST_VERCEL_API_URL === '1') return false;
  try {
    const normalized =
      env.startsWith('http://') || env.startsWith('https://') ? env : `https://${env}`;
    return isVercelDeploymentHost(new URL(normalized).hostname);
  } catch {
    return false;
  }
}
