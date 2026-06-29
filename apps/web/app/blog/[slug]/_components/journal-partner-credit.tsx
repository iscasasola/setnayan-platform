import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, BadgeCheck } from 'lucide-react';
import {
  PLACEMENT_LABELS,
  type JournalSpotlightPublic,
} from '@/lib/journal-spotlights';

/**
 * JournalPartnerCredit — the public "Featured partner / In partnership with"
 * credit block rendered on /blog/[slug] for APPROVED journal spotlights (Wave 5
 * Editorial & Journal Spotlights).
 *
 * Each credited vendor shows their logo + business name + a DOFOLLOW link to
 * their public marketplace presence (/v/[slug]) — the dofollow link is the SEO
 * benefit the vendor is being credited with. A `sponsored` placement carries an
 * unambiguous "Sponsored" badge (0038 disclosure rule); free placements
 * (featured_partner / recommended) do not.
 *
 * Pure presentation — the parent page fetches the approved rows (drafts never
 * reach here). Renders nothing when there are no credits.
 */

export function JournalPartnerCredit({
  spotlights,
}: {
  spotlights: JournalSpotlightPublic[];
}) {
  if (!spotlights || spotlights.length === 0) return null;

  return (
    <section
      aria-label="Featured partners"
      className="mt-14 rounded-3xl border border-ink/10 bg-white/60 p-6 sm:p-8"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">
        With thanks to
      </p>
      <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
        Featured in this story
      </h2>

      <ul className="mt-6 space-y-4">
        {spotlights.map((s) => {
          const name = s.business_name ?? 'A Setnayan vendor';
          const href = s.business_slug ? `/v/${s.business_slug}` : null;
          return (
            <li
              key={s.spotlight_id}
              className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                {s.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.logo_url}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-ink/10"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink/[0.06] text-ink/40">
                    <BadgeCheck className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                      {PLACEMENT_LABELS[s.placement]}
                    </span>
                    {s.is_sponsored ? (
                      <span
                        className="inline-flex items-center rounded-full bg-ink/[0.07] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/70"
                        title="This is a paid sponsored placement"
                      >
                        Sponsored
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate font-display text-lg font-medium leading-snug text-ink">
                    {name}
                  </p>
                </div>
              </div>

              {href ? (
                <Link
                  href={href}
                  // Dofollow (no rel="nofollow") — the credited vendor earns the
                  // link equity. Opens in the same tab to keep the editorial
                  // hub-and-spoke internal-link graph intact.
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-mulberry/25 px-4 py-2 text-sm font-semibold text-mulberry transition-colors hover:bg-mulberry/[0.06] sm:self-auto"
                >
                  View profile
                  <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-xs text-ink/45">
        Vendors are credited by the Setnayan editorial team.{' '}
        {spotlights.some((s) => s.is_sponsored)
          ? 'Placements marked “Sponsored” are paid partnerships.'
          : null}
      </p>
    </section>
  );
}
