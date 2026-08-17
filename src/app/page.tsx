import { connection } from "next/server";

import TravelFormPage from "@/components/travel-form/TravelFormPage";

export default async function Home() {
  // Forces dynamic rendering — required for the CSP nonce set in src/proxy.ts to reach
  // this page's scripts. Statically prerendered pages have no request/response headers
  // at build time, so no nonce can be injected, and every script gets blocked by the CSP.
  await connection();
  return <TravelFormPage />;
}
