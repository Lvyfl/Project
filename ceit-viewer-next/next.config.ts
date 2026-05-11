import type { NextConfig } from "next";

/** Real Express API origin (Railway, Render, etc.). Used to proxy /ceit-api/* on Vercel. */
const backend = (process.env.BACKEND_URL || "").trim().replace(/\/$/, "");

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
