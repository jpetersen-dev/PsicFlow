import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/booking/articles/:slug",
        destination: "/api/v1/booking/articles?slug=:slug",
      },
      {
        source: "/api/v1/integrations/articles/:slug",
        destination: "/api/v1/integrations/articles?slug=:slug",
      },
    ];
  },
};

export default nextConfig;
