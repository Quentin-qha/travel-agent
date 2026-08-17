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

function resolvePath(source: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
}

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

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

export function useDateFnsLocale() {
  const { locale } = useLanguage();
  return locale === "en" ? enUS : frLocale;
}
