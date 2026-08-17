import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME } from "./cookieName";
import type { Locale } from "./translations";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE_NAME)?.value === "en" ? "en" : "fr";
}
