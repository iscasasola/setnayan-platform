import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, BadgeCheck } from 'lucide-react';
import {
  PLACEMENT_LABELS,
  type JournalSpotlightPublic,
} from '@/lib/journal-spotlights';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import type { InquirySource } from '@/lib/inquiry-source';

/**
 * 🎟 THE LINK CARRIES WHERE THE READER CAME FROM.
 *
 * A reader who leaves one of our articles for a credited shop used to arrive
 * as an anonymous walk-in: the link was a bare `/v/{slug}` with nothing on it.
 * The shop page reads `?src=` and stamps the inquiry's origin server-side, so
 * with no tag the enquiry was labelled the plain website default — and
 * `'editorial'` is in the SOURCED set (`SOURCED_INQUIRY_SOURCES`, mirrored in
 * SQL by `booking_fee_is_sourced_surface`), while the default is not. So an
 * article that actually produced a booking could never be counted as one
 * Setnayan brought. The writing was earning introductions it got no credit
 * for, silently, with nothing in the app able to notice.
 *
 * `/realstories` already did this correctly through `VendorCreditChip`; this
 * is the same arrival tag on the other surface that credits vendors.
 *
 * ⚠ TYPED, NOT A LOOSE STRING. `?src=` is re-validated server-side against a
 * fixed set, so a typo here would not throw — it would simply be ignored and
 * the reader would arrive untracked again, which is the exact bug this fixes
 * and is invisible from the page. Typing it as `InquirySource` makes a typo a
 * BUILD failure instead of a silent one.
 */
const ARRIVAL_TAG: InquirySource = 'editorial';

/**
 * JournalPartnerCredit — the public "Featured partner / In partnership with"
 * credit block rendered on /blog/[slug] for APPROVED journal spotlights (Wave 5
 * Editorial & Journal Spotlights).
 *
 * Each credited vendor shows their logo + business name + a DOFOLLOW link to
 * their public marketplace presence (the canonical bare-root `/{slug}`, tagged
 * with where the reader came from — see ARRIVAL_TAG below) — the dofollow link
 * is the SEO benefit the vendor is being credited with. A `sponsored` placement carries an
 * unambiguous "Sponsored" badge (0038 disclosure rule); free placements
 * (featured_partner / recommended) do not.
 *
 * The parent page fetches the approved rows (drafts never reach here). Renders
 * nothing when there are no credits.
 *
 * 🪤 `logo_url` DOES NOT HOLD A URL. `fetchApprovedSpotlightsForSlug` reads it
 * through an embedded `vendor_profiles` join, and that column stores an
 * `r2://bucket/key` reference — a browser cannot fetch it, so it rendered a
 * broken-image glyph beside the credited vendor's name on a PUBLIC, crawlable
 * article. Nothing throws and nothing logs; the only symptom is the absence of a
 * picture on the one block whose whole purpose is to credit someone.
 */

/**
 * Presign one stored logo reference for display. Swallows failures on purpose:
 * a logo is decoration and the row already falls back to a BadgeCheck tile, so a
 * signing hiccup must never take a published article down.
 */
/**
 * ⏳ THE TTL MUST OUTLIVE THE PAGE, AND HERE THE PAGE IS BAKED AT BUILD TIME.
 *
 * `app/blog/[slug]/page.tsx` sets `dynamicParams = false` with
 * `generateStaticParams` over an in-code article list, and `revalidate = 3600`.
 * So the HTML — including this signed URL — is prerendered once and then served
 * stale-while-revalidate. The default presign TTL is 24 hours. On a quiet
 * article nothing forces a re-render inside that window, so the credit logo
 * would simply start 403ing a day after the build: the picture disappears with
 * no deploy, no error and no code change, which is close to unfindable.
 *
 * Seven days gives a wide margin over any realistic revalidation gap. Read the
 * page's caching directives before copying this number anywhere else — the
 * right TTL is a function of how long the HTML holding it may live.
 */
const PRERENDERED_PAGE_TTL_SECONDS = 60 * 60 * 24 * 7;

async function resolveDisplayUrl(value: string | null | undefined): Promise<string | null> {
  try {
    return await displayUrlForStoredAsset(value, {
      ttlSeconds: PRERENDERED_PAGE_TTL_SECONDS,
    });
  } catch {
    return null;
  }
}

export async function JournalPartnerCredit({
  spotlights,
}: {
  spotlights: JournalSpotlightPublic[];
}) {
  if (!spotlights || spotlights.length === 0) return null;

  // ONE batch before the render — each resolve is a separate signing round trip,
  // and the map callback below is not async so it could not await anyway.
  // Indexed by position: `logoUrls[i]` belongs to `spotlights[i]`.
  const logoUrls = await Promise.all(spotlights.map((s) => resolveDisplayUrl(s.logo_url)));

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
        {spotlights.map((s, i) => {
          const name = s.business_name ?? 'A Setnayan vendor';
          // The BARE ROOT is the shop's canonical address; `/v/{slug}` is the
          // legacy form. The shop page self-canonicalises to the clean
          // bare-root URL, so the `?src=` tag costs the credited vendor no
          // link equity — which is the whole point of crediting them here.
          const href = s.business_slug
            ? `/${s.business_slug}?src=${ARRIVAL_TAG}`
            : null;
          const logoUrl = logoUrls[i] ?? null;
          return (
            <li
              key={s.spotlight_id}
              className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
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
