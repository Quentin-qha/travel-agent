import { NextRequest, NextResponse } from "next/server";
import { getServerEditToken } from "@/lib/editTokenServer";
import { API_URL } from "@/lib/apiUrl";

// Proxies regeneration so the edit token is read from its HttpOnly cookie
// server-side and attached to the backend call here, instead of being read
// from JS on the client and sent as a header (which required the cookie to
// be JS-readable, i.e. stealable by XSS).
/**
 * `POST /api/itinerary/{id}/regenerate` (Next.js Route Handler) — proxies regeneration
 * to the FastAPI backend. Called by `ItineraryMapView.tsx` instead of hitting the backend
 * directly, so the edit-token cookie (HttpOnly, never readable by client JS) can be read
 * here server-side and forwarded as the `X-Edit-Token` header the backend expects.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = request.nextUrl.searchParams.get("lang") ?? "fr";
  const body = await request.text();
  const editToken = await getServerEditToken(id);

  const backendResponse = await fetch(`${API_URL}/api/itinerary/${id}/regenerate?lang=${lang}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(editToken ? { "X-Edit-Token": editToken } : {}),
    },
    body,
  });

  const payload = await backendResponse.json().catch(() => null);
  return NextResponse.json(payload, { status: backendResponse.status });
}
