import { cookies } from "next/headers";

// Must match EDIT_TOKEN_COOKIE_PREFIX in ./editToken.ts — duplicated because
// this module imports next/headers (server-only) and can't be pulled into
// the client bundle.
const EDIT_TOKEN_COOKIE_PREFIX = "travel-agent-edit-token-";

export async function getServerEditToken(itineraryId: string): Promise<string | null> {
  const store = await cookies();
  return store.get(`${EDIT_TOKEN_COOKIE_PREFIX}${itineraryId}`)?.value ?? null;
}
