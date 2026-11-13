import Link from 'next/link';
import { loadSampleOrNotFound } from '@/lib/sample-event/switch.server';

/**
 * `/sample` — the landing: the sample event and the three people a visitor can
 * look around as (DECISION_LOG 2026-11-02 "THREE PERSONAS": the bride's cousin,
 * the bride's sister, the couple).
 *
 * S1 (this slice) draws them as PLACEHOLDERS — nothing here is pressable yet,
 * so nothing wears a frame (house rule: frames only on what you press). Slice
 * S3 turns each row into its door (`/sample/hub/[guestKey]`,
 * `/sample/dashboard/…`) and adds the "See another guest" switcher.
 *
 * Everything on this page comes from `loadSampleOrNotFound()` — fixtures, never
 * a table.
 */
export default async function SampleLandingPage() {
  const sample = await loadSampleOrNotFound();
  return (
    <main className="min-h-dvh w-full bg-page text-ink" data-sample-landing="">
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-8 sm:pt-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">Sample event</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{sample.displayName}</h1>
        <p className="mt-3 text-base text-ink/75">
          A wedding in preparation. Look around as one of three people — nothing you do here is saved.
        </p>

        <ul className="mt-10 divide-y divide-ink/10 border-y border-ink/10" aria-label="Look around as">
          {sample.personas.map((p) => (
            <li key={p.key} className="flex items-start justify-between gap-4 py-5" data-sample-persona={p.key}>
              <div className="min-w-0">
                <p className="text-lg font-medium">{p.title}</p>
                <p className="mt-1 text-sm text-ink/70">{p.line}</p>
              </div>
              <span className="shrink-0 pt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                Opening soon
              </span>
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
