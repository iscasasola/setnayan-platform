import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { loadSampleOrNotFound } from '@/lib/sample-event/switch.server';

/**
 * `/sample` — the landing: the sample event and the three people a visitor can
 * look around as (DECISION_LOG 2026-11-02 "THREE PERSONAS": the bride's cousin,
 * the bride's sister, the couple).
 *
 * Each persona with a built guest hub is its door (`/sample/hub/[guestKey]`); one with no view yet is not offered
 * (final check A1-004).
 *
 * Everything on this page comes from `loadSampleOrNotFound()` — fixtures, never
 * a table.
 */
export default async function SampleLandingPage() {
  const sample = await loadSampleOrNotFound();
  const openable = sample.personas.filter((p): p is typeof p & { guestKey: string } => Boolean(p.guestKey));
  return (
    <main className="min-h-dvh w-full bg-page text-ink" data-sample-landing="">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">Sample event</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{sample.displayName}</h1>
        {/*
          🚪 ONLY A PERSONA WITH A BUILT VIEW IS OFFERED (final check A1-004). Each row used to be static text tagged
          "Opening soon" — nothing pressable, and a promise about a feature not yet live. A persona with a guest hub opens
          it; one with none yet is not listed. The count in the line is the rows drawn, never typed.
        */}
        <p className="mt-3 text-base text-ink/75">
          A wedding in preparation. Look around as {openable.length === 1 ? 'a guest' : `one of ${formatCount(openable.length)} guests`} — nothing you do here is saved.
        </p>

        <ul className="mt-10 divide-y divide-ink/10 border-y border-ink/10" aria-label="Look around as">
          {openable.map((p) => (
            <li key={p.key} data-sample-persona={p.key}>
              <Link href={`/sample/hub/${p.guestKey}`} className="sn-press flex min-h-11 items-start justify-between gap-4 py-5">
                <span className="min-w-0">
                  <span className="block text-lg font-medium">{p.title}</span>
                  <span className="mt-1 block text-sm text-ink/70">{p.line}</span>
                </span>
                <ChevronRight aria-hidden className="mt-1 h-5 w-5 shrink-0 text-ink/55" strokeWidth={1.75} />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10">
          <Link
            href="/onboarding/wedding"
            className="inline-flex min-h-11 items-center rounded-full bg-mulberry px-5 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            Start your own event
          </Link>
        </p>
      </div>
    </main>
  );
}
