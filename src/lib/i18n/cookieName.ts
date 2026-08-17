// Zero-dependency module (no next/headers) so it can be imported from both
// the client bundle (LanguageProvider.tsx) and server-only code (locale.ts)
// without either side duplicating the literal string.
export const LOCALE_COOKIE_NAME = "travel-agent-locale";
