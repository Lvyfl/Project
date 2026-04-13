import type { NextConfig } from "next";

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
