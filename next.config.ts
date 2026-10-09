import type { NextConfig } from "next";
const config: NextConfig = {
  output: process.env.ER_LOCAL_API_URL ? undefined : "export",
  ...(process.env.ER_LOCAL_API_URL
    ? {
        async rewrites() {
          return [
            {
              source: "/api/projects/:path*",
              destination: `${process.env.ER_LOCAL_API_URL}/api/projects/:path*`,
            },
          ];
        },
      }
    : {}),
  images: { unoptimized: true },
  experimental: { cpus: 2 },
};
export default config;
