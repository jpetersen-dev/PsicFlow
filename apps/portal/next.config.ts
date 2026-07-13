import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
    ],
  },
  async rewrites() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/v1/booking/:path*',
        destination: `${appUrl}/api/v1/booking/:path*`,
      },
    ];
  },
};

export default nextConfig;
