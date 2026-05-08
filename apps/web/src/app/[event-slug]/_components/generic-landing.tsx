import type { Event } from "@/lib/db/types";

/** Shown when no guest is identified (no token, expired token, no cookie). */
export function GenericLanding({ event }: { event: Event }) {
  const couple = `${event.bride_first_name} & ${event.groom_first_name}`;
  return (
    <main className="flex min-h-screen items-center justify-center bg-page-bg p-6">
      <div className="w-full max-w-[420px] rounded-2xl border border-rule bg-surface p-8 text-center shadow-tayo-sm">
        <p className="meta-label mb-3">Personal Invitation</p>
        <h1 className="display-title">{couple}</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Use the invite link from the couple to open your personal page.
        </p>
        <p className="meta-label mt-8">Powered by Tayo</p>
      </div>
    </main>
  );
}
