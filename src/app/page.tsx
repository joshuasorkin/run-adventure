"use client";

export default function StartPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-dvh p-6 text-center">
      <h1 className="text-4xl font-bold mb-2">Run Adventure</h1>
      <p className="text-[var(--muted)] mb-8 max-w-sm">
        A location-based quest around your neighborhood.
        Run to real places, collect items, complete the quest.
      </p>

      <a
        href="/configure"
        className="bg-[var(--accent)] text-black font-bold text-lg px-8 py-4 rounded-2xl
                   active:scale-95 transition-transform inline-block"
      >
        Generate Quest
      </a>

      <p className="text-[var(--muted)] text-xs mt-12">
        Requires location permission. Run outdoors safely.
      </p>
    </main>
  );
}
