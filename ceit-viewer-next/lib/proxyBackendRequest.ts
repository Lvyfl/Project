import { NextRequest, NextResponse } from 'next/server';

function backendBase(): string | null {
  const raw = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (!raw) return null;
  const base = raw.replace(/\/$/, '');
  if (process.env.NEXT_PUBLIC_TRUST_VERCEL_API_URL === '1') return base;
  try {
    const host = new URL(
      base.startsWith('http://') || base.startsWith('https://') ? base : `https://${base}`,
    ).hostname.toLowerCase();
    if (host.endsWith('.vercel.app') || host === 'vercel.app') return null;
  } catch {
    return null;
  }
  return base;
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

export async function proxyBackendRequest(req: NextRequest, pathParts: string[]) {
  const base = backendBase();
  if (!base) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid API URL. In Vercel → Environment Variables, set BACKEND_URL or NEXT_PUBLIC_API_URL to https://ceit-backend.onrender.com (Project Root must be ceit-viewer-next).',
      },
      { status: 503 },
    );
  }

  const subPath = pathParts.length ? `/${pathParts.join('/')}` : '/';
  const target = `${base}${subPath}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  let body: BodyInit | undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: 'manual',
  });

  const out = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
  });

  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    out.headers.set(key, value);
  });

  return out;
}
