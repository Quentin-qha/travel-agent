import { notFound } from "next/navigation";
import ItineraryResultView from "@/components/travel-form/ItineraryResultView";
import TravelFormPage from "@/components/travel-form/TravelFormPage";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CatchAllPage(props: PageProps<"/[id]">) {
  const { id } = await props.params;

  if (!UUID_PATTERN.test(id)) {
    return <TravelFormPage name={decodeURIComponent(id)} />;
  }

  const response = await fetch(`${API_URL}/api/itinerary/${id}`, { cache: "no-store" });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const itinerary = await response.json();

  return (
    <main className="flex min-h-screen justify-center bg-gradient-to-b from-violet-50 via-white to-white px-4 py-12 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-zinc-200/80 bg-white/80 p-5 shadow-xl shadow-zinc-900/5 backdrop-blur-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/60">
          <ItineraryResultView itinerary={itinerary} />
        </div>
      </div>
    </main>
  );
}
