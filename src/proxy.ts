import { NextRequest, NextResponse } from "next/server";

// Same-origin API proxy now handles every state-changing call (see
// src/app/api/itinerary/**), so the browser never needs to reach the FastAPI
// backend directly except for the two remaining client-side fetches:
// Nominatim (CityAutocomplete) and CARTO map tiles (img-src, loaded by
// Leaflet as plain <img> elements, not fetch/XHR).
const NOMINATIM_ORIGIN = "https://nominatim.openstreetmap.org";
const CARTO_TILES_ORIGIN = "https://*.basemaps.cartocdn.com";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    // strict-dynamic + nonce lets Next's own hydration/chunk scripts run
    // without needing a broad 'unsafe-inline'. unsafe-eval is dev-only, for
    // the bundler's HMR runtime.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Leaflet's marker/popup HTML is built as raw strings with inline
    // `style="..."` attributes (see ItineraryMap.tsx) — no nonce is
    // practical there, so style-src keeps 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${CARTO_TILES_ORIGIN}`,
    `connect-src 'self' ${NOMINATIM_ORIGIN}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
