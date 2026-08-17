import { NextRequest, NextResponse } from "next/server";
import { editTokenCookieName } from "@/lib/editTokenServer";
import { API_URL } from "@/lib/apiUrl";
import type { ItineraryResult } from "@/components/travel-form/types";

// Proxies itinerary creation. The backend still returns an edit_token in the
// JSON body, but it never reaches the browser: this route strips it and sets
// it as an HttpOnly cookie instead, so page JS (and any future XSS) can't
// read it. Previously the token was returned to the client and stored via
// document.cookie, readable by any script on the page for its full lifetime.
/**
 * `POST /api/itinerary` (Next.js Route Handler) — proxies trip generation to the
 * FastAPI backend. Called by `TravelForm.tsx` instead of hitting the backend directly,
 * specifically so the `edit_token` in the response can be turned into an HttpOnly
 * cookie here rather than ever being readable by client-side JS.
 */
export async function POST(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("lang") ?? "fr";
  const body = await request.text();

  const backendResponse = await fetch(`${API_URL}/api/itinerary?lang=${lang}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const payload = await backendResponse.json().catch(() => null);
  if (!backendResponse.ok || !payload) {
    return NextResponse.json(payload ?? { detail: "Erreur backend" }, { status: backendResponse.status || 502 });
  }

  const { edit_token, ...result } = payload as ItineraryResult & { edit_token?: string | null };
  const response = NextResponse.json(result);

  if (result.id && edit_token) {
    response.cookies.set(editTokenCookieName(result.id), edit_token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
