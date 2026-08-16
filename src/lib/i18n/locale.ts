import { cookies } from "next/headers";
import type { Locale } from "./translations";

export const LOCALE_COOKIE = "travel-agent-locale";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "en" ? "en" : "fr";
}
