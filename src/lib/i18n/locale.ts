import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME } from "./cookieName";
import type { Locale } from "./translations";

/**
 * Server-side counterpart of `useLanguage()`'s `locale` — reads the same cookie via
 * `next/headers`, so a Server Component (page `/library`, page `/[id]`) can request
 * content in the right language *before* the first render, which `useLanguage()`
 * (client-only) can't do. Defaults to `"fr"` if the cookie is missing or invalid.
 */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE_NAME)?.value === "en" ? "en" : "fr";
}
