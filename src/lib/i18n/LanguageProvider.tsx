"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { enUS, fr as frLocale } from "date-fns/locale";
import { TRANSLATIONS, type Locale } from "./translations";
import { LOCALE_COOKIE_NAME } from "./cookieName";

const LOCALE_CHANGE_EVENT = "travel-agent-locale-change";

function readCookieLocale(): Locale {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "fr" || value === "en" ? value : "fr";
}

function getSnapshot(): Locale {
  return readCookieLocale();
}

function getServerSnapshot(): Locale {
  return "fr";
}

function subscribe(callback: () => void) {
  window.addEventListener(LOCALE_CHANGE_EVENT, callback);
  return () => window.removeEventListener(LOCALE_CHANGE_EVENT, callback);
}

/** Looks up a dot-separated path (e.g. `"generationLoader.steps"`) inside a translations object. */
function resolvePath(source: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

/** Replaces `{name}` placeholders in `template` with values from `vars`; leaves unmatched placeholders as-is. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tList: (key: string) => string[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Mounts once in `layout.tsx`, wrapping the whole app. Provides `locale`/`setLocale`/`t`/`tList`
 * to any descendant via `useLanguage()`. The locale itself lives in the `travel-agent-locale`
 * cookie (not React state) so it survives navigation and stays readable server-side — this
 * component just subscribes to that cookie via `useSyncExternalStore` and re-renders on change.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    // 1 year, readable by both client (document.cookie) and Server Components (next/headers).
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const value = resolvePath(TRANSLATIONS[locale], key);
      return typeof value === "string" ? interpolate(value, vars) : key;
    },
    [locale],
  );

  const tList = useCallback(
    (key: string) => {
      const value = resolvePath(TRANSLATIONS[locale], key);
      return Array.isArray(value) ? (value as string[]) : [];
    },
    [locale],
  );

  return <LanguageContext.Provider value={{ locale, setLocale, t, tList }}>{children}</LanguageContext.Provider>;
}

/**
 * Access to the current locale and translation helpers. Must be called from a Client Component
 * rendered under `<LanguageProvider>` (i.e. anywhere in the app) — throws otherwise.
 *
 * - `t(key, vars?)` — resolves a dot-path key (e.g. `t("form.title")`) to a translated string,
 *   interpolating `{placeholders}` from `vars`. Returns the key itself if not found.
 * - `tList(key)` — same lookup, for keys whose value is a string array (e.g. rotating loader messages).
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

/** The date-fns locale object (`fr` or `enUS`) matching the current UI language, for date formatting. */
export function useDateFnsLocale() {
  const { locale } = useLanguage();
  return locale === "en" ? enUS : frLocale;
}
