import { cookies } from "next/headers";

const EDIT_TOKEN_COOKIE_PREFIX = "travel-agent-edit-token-";

// The token itself is only ever set/read server-side (see
// src/app/api/itinerary/route.ts and .../[id]/regenerate/route.ts) — it's
// stored as an HttpOnly cookie so page JS (and by extension XSS) can never
// read it, unlike the old client-set cookie.
export function editTokenCookieName(itineraryId: string): string {
  return `${EDIT_TOKEN_COOKIE_PREFIX}${itineraryId}`;
}

export async function getServerEditToken(itineraryId: string): Promise<string | null> {
  const store = await cookies();
  return store.get(editTokenCookieName(itineraryId))?.value ?? null;
}
