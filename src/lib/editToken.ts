// Client-side cookie helpers for per-itinerary edit tokens. Must match the
// prefix duplicated in editTokenServer.ts — that file imports next/headers
// and can't be pulled into this client bundle (same split as ./i18n/locale.ts
// vs LanguageProvider.tsx).
const EDIT_TOKEN_COOKIE_PREFIX = "travel-agent-edit-token-";

export function setEditTokenCookie(itineraryId: string, token: string) {
  document.cookie = `${EDIT_TOKEN_COOKIE_PREFIX}${itineraryId}=${encodeURIComponent(token)}; path=/; max-age=31536000; samesite=lax`;
}

export function getEditTokenCookie(itineraryId: string): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${EDIT_TOKEN_COOKIE_PREFIX}${itineraryId}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
