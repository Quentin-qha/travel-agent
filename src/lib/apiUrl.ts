// Every server-side call to the FastAPI backend (Server Components, Route
// Handlers) goes through this. Throws in production instead of silently
// falling back to localhost — a missing env var there would otherwise make
// the deployed app quietly try to reach a backend that doesn't exist there.
if (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_API_URL must be set in production.");
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
