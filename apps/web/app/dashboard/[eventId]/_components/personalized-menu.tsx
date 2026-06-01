import Link from 'next/link';
import { Sparkles, ArrowRight, Store } from 'lucide-react';

/**
 * PersonalizedMenu — the couple's personalized "for you" surface.
 *
 * WHY (owner directive 2026-06-02 · CLAUDE.md): the couple event-home was
 * "clustered" — it re-rendered ~7 other owned tabs (plan grid, budget,
 * money, schedule, marketplace, full activity). The lean home keeps two
 * blocks: a personalized menu + the activity feed. This is the menu.
 *
 * It is built ONLY from data the app already has in production:
 *   - taste chips ← the `events` row (date · ceremony · budget · guests ·
 *     venue setting)
 *   - "your services" ← the couple's `event_vendors` (the vendors they've
 *     added / shortlisted / locked), each with a status pill + a link.
 *
 * The richer "taste from onboarding" (feel / dietary / style) is NOT
 * captured in production yet (the onboarding personalization flow is a
 * prototype, V1.x) — so it is deliberately NOT fabricated here. When
 * onboarding ships, its captured preferences feed into `tasteChips`.
 *
 * Pure presentational server component — the host page does the data
 * mapping (event fields → tasteChips, event_vendors → services) so this
 * component has no DB / vendor-lib coupling and stays trivially testable.
 * Clean Editorial palette throughout.
 *
 * variant='preview' (home) caps the service list + shows a "See all →"
 * link to /for-you. variant='full' (/for-you) shows everything.
 */

export type TasteChip = { label: string };

export type ServiceTone = 'locked' | 'shortlisted' | 'neutral';

export type ServiceRow = {
  id: string;
  name: string;
  category: string;
  statusLabel: string;
  tone: ServiceTone;
  href: string;
};

const PREVIEW_LIMIT = 5;

const TONE_CLASS: Record<ServiceTone, string> = {
  // emerald = secured (downpayment / locked), gold = considering, neutral = other
  locked: 'bg-[var(--m-emerald,#2F7D5B)]/12 text-[var(--m-emerald,#2F7D5B)]',
  shortlisted: 'bg-terracotta/12 text-terracotta',
  neutral: 'bg-ink/8 text-ink/60',
};

export function PersonalizedMenu({
  eventId,
  variant,
  tasteChips,
  services,
}: {
  eventId: string;
  variant: 'preview' | 'full';
  tasteChips: TasteChip[];
  services: ServiceRow[];
}) {
  const base = `/dashboard/${eventId}`;
  const shown = variant === 'preview' ? services.slice(0, PREVIEW_LIMIT) : services;
  const hiddenCount = services.length - shown.length;

  return (
    <section
      aria-labelledby="personalized-menu-heading"
      className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="personalized-menu-heading"
          className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          <Sparkles aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
          Personalized for you
        </h2>
      </div>

      {/* Taste chips — the couple's wedding shape, from the event row. */}
      {tasteChips.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {tasteChips.map((chip) => (
            <li
              key={chip.label}
              className="rounded-full border border-ink/12 bg-paper px-3 py-1 text-xs text-ink/75"
            >
              {chip.label}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Your services — the vendors the couple has added, with status. */}
      {services.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            Your services
          </p>
          <ul className="space-y-1.5">
            {shown.map((svc) => (
              <li key={svc.id}>
                <Link
                  href={svc.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink/8 bg-paper px-3 py-2.5 transition-colors hover:border-ink/20"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {svc.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
                      {svc.category}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${TONE_CLASS[svc.tone]}`}
                  >
                    {svc.statusLabel}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {variant === 'preview' && hiddenCount > 0 ? (
            <Link
              href={`${base}/for-you`}
              className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-terracotta hover:underline"
            >
              See all {services.length} services
              <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          ) : null}
        </div>
      ) : (
        /* Honest empty state — no fabricated rows. */
        <Link
          href={`${base}/vendors`}
          className="flex items-center gap-2.5 rounded-xl border border-dashed border-ink/20 bg-paper px-3 py-3 text-sm text-ink/70 transition-colors hover:border-terracotta/50"
        >
          <Store aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Pick your first vendor — start building your wedding
          <ArrowRight aria-hidden className="ml-auto h-4 w-4 text-terracotta" strokeWidth={1.75} />
        </Link>
      )}
    </section>
  );
}
