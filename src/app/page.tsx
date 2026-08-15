import TravelForm from "@/components/travel-form/TravelForm";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-violet-50 via-white to-white px-4 py-12 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-50">Planifie ton voyage</h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            Réponds à quelques questions, on s&apos;occupe du reste.
          </p>
        </div>

        <TravelForm />
      </div>
    </main>
  );
}
