import { cookies } from "next/headers";

const EDIT_TOKEN_COOKIE_PREFIX = "travel-agent-edit-token-";

// The token itself is only ever set/read server-side (see
// src/app/api/itinerary/route.ts and .../[id]/regenerate/route.ts) — it's
// stored as an HttpOnly cookie so page JS (and by extension XSS) can never
// read it, unlike the old client-set cookie.
/** Name of the per-trip HttpOnly cookie storing its edit token — one cookie per trip id. */
export function editTokenCookieName(itineraryId: string): string {
  return `${EDIT_TOKEN_COOKIE_PREFIX}${itineraryId}`;
}

/**
 * Reads a trip's edit token from its cookie, server-side only (uses `next/headers`).
 * Used by `src/app/[id]/page.tsx` (to compute `can_edit` on read) and by the
 * `/api/itinerary/[id]/regenerate` route (to attach `X-Edit-Token` when proxying to
 * the backend). Returns `null` if the cookie was never set (e.g. a trip not created
 * by this browser, or one saved before this system existed).
 */
export async function getServerEditToken(itineraryId: string): Promise<string | null> {
  const store = await cookies();
  return store.get(editTokenCookieName(itineraryId))?.value ?? null;
}
