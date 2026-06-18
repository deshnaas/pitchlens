import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large video files in public directory
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
  // Headers for video streaming support
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Bypass the ngrok browser-warning interstitial
          { key: "ngrok-skip-browser-warning", value: "true" },
        ],
      },
      {
        source: "/videos/:path*",
        headers: [
          { key: "Accept-Ranges", value: "bytes" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
