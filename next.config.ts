import type { NextConfig } from "next";

const defaultOrigins = "https://creativewaco.org https://www.creativewaco.org";
const frameAncestors = (process.env.EMBED_ALLOWED_ORIGINS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .join(" ") || defaultOrigins
).trim();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
