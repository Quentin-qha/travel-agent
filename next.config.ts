import type { NextConfig } from "next";

// image_url fields never point at Google directly — they point at the
// backend's own /api/photo/{ref} proxy (see backend/app/api/routes/photo.py),
// which lives at the same origin as NEXT_PUBLIC_API_URL. That's the only
// remote host next/image ever needs to fetch through.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");
const isLocalApiHost = ["localhost", "127.0.0.1", "::1"].includes(apiUrl.hostname);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/api/photo/**",
      },
    ],
    // Next.js 16 refuses to fetch remote images that resolve to a private/
    // loopback IP by default (SSRF guard). Only relevant in local dev, where
    // the backend genuinely runs on localhost — a real deployment points
    // NEXT_PUBLIC_API_URL at a public backend domain, so this stays off there.
    dangerouslyAllowLocalIP: isLocalApiHost,
  },
};

export default nextConfig;
