import type { NextConfig } from "next";

// image_url fields never point at Google directly — they point at the backend's own
// /api/photo/{ref} proxy (see backend/app/api/routes/photo.py). Local dev and the deployed
// backend share the same Supabase database, so a locally-run frontend (NEXT_PUBLIC_API_URL
// pointing at localhost) can easily be looking at a trip whose image_url was written by the
// deployed backend, or vice versa — both hosts need to be trusted regardless of which one is
// currently configured, or next/image rejects the "unknown" one with a hard error.
// Update this if the deployed backend's URL ever changes (custom domain, redeploy elsewhere).
const PRODUCTION_API_URL = "https://travel-agent-backend-822347154476.us-central1.run.app";

const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");
const isLocalApiHost = ["localhost", "127.0.0.1", "::1"].includes(apiUrl.hostname);

function photoRemotePattern(url: URL) {
  return {
    protocol: url.protocol.replace(":", "") as "http" | "https",
    hostname: url.hostname,
    port: url.port,
    pathname: "/api/photo/**",
  } as const;
}

const remotePatterns = [photoRemotePattern(apiUrl)];
if (apiUrl.origin !== PRODUCTION_API_URL) {
  remotePatterns.push(photoRemotePattern(new URL(PRODUCTION_API_URL)));
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
    // Next.js 16 refuses to fetch remote images that resolve to a private/
    // loopback IP by default (SSRF guard). Only relevant in local dev, where
    // the backend genuinely runs on localhost — a real deployment points
    // NEXT_PUBLIC_API_URL at a public backend domain, so this stays off there.
    dangerouslyAllowLocalIP: isLocalApiHost,
  },
};

export default nextConfig;
