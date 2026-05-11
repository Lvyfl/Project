import type { NextConfig } from "next";

/**
 * API proxy: `/api/ceit/*` → `app/api/ceit/[[...path]]/route.ts` (BACKEND_URL / NEXT_PUBLIC_API_URL on the server).
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost', port: '3000', pathname: '/**' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/ceit-api/:path*',
        destination: '/api/ceit/:path*',
        permanent: false,
      },
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
