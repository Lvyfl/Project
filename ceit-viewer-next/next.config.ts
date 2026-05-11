import type { NextConfig } from "next";

function isVercelDeploymentUrl(u: string): boolean {
  if (!u) return false;
  try {
    const host = new URL(
      u.startsWith("http://") || u.startsWith("https://") ? u : `https://${u}`,
    ).hostname.toLowerCase();
    return host.endsWith(".vercel.app") || host === "vercel.app";
  } catch {
    return true;
  }
}

const rawBack = (process.env.BACKEND_URL || "").trim().replace(/\/$/, "");
const rawPub = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
/**
 * Proxy target for /ceit-api/* — prefer BACKEND_URL.
 * If only NEXT_PUBLIC_API_URL is set and it is a real API host (not *.vercel.app), use it so one env works.
 */
const backend = rawBack || (!isVercelDeploymentUrl(rawPub) ? rawPub : "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost', port: '3000', pathname: '/**' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    if (!backend) return [];
    return [
      {
        source: "/ceit-api/:path*",
        destination: `${backend}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/viewer.html',
        destination: '/viewer',
        permanent: false,
      },
      {
        source: '/events.html',
        destination: '/events',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
