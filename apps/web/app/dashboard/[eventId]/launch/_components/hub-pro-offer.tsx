import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { HubProOffer } from '@/lib/event-hub-pro';

/**
 * THE ONE UNLOCK, DRAWN WHERE IT IS MISSED — S4, attached to the live channel.
 *
 * Design § 5.1 rule 1: *"every upgrade is offered at the point of absence … not
 * a shop tab."* So this block sits directly under the four-stage grid, named for
 * the channel the couple is standing on, rather than in a rail at the foot of
 * the page. Drawing: prototype § 4 (`.pro`) — a gold dashed panel, the seven
 * chips with one lit, one CTA.
 *
 * ── WHY IT IS ITS OWN FILE ─────────────────────────────────────────────────
 * The same reason `hub-stage.tsx` is: so a test can RENDER it. The disease this
 * whole stream exists to cure is a decision that never reaches the pixel, and a
 * resolver test cannot prove a render. `hub-pro-offer-renders.test.ts` mounts
 * this and reads the emitted HTML — including the case where an OWNING couple
 * must see nothing at all.
 *
 * It is presentational and PURE: the offer arrives already resolved from
 * `lib/event-hub-pro.ts`, and the price arrives already formatted from the live
 * catalog. It performs no I/O, resolves no phase and owns no gate.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🔑 SHOW IT WORKING — DO NOT DIM AND LOCK (owner-locked 2026-07-25, verbatim)
 * ══════════════════════════════════════════════════════════════════════════
 * *"Seeing the cameras actually working IS the conversion mechanism; hiding or
 * dimming them recreates the exact defect Wave 3 exists to fix — asking ₱3,000
 * for an experience the couple has never felt, for a day that cannot be redone."*
 *
 * So this component adds NOTHING over the content above it. No greyscale tile,
 * no 🔒 badge, no `opacity-*` on a channel card, no overlay. The four stage cards
 * and the miniature stay exactly as bright as they are for a couple who has
 * paid; the offer is a panel BESIDE the working thing, never a lid on it.
 * `hub-pro-offer-renders.test.ts` asserts the absence of a lock glyph and of any
 * dimming class, because "we did not add one" is not a thing a reader can check.
 *
 * ⛔ AND NO PRICE IS TYPED. `priceLabel` is `formatPhp` over the live
 * `platform_retail_catalog_v2` row. When the catalog read fails it is null and
 * the panel simply omits the figure — an offer with no number is honest; an
 * offer with a stale number is not. Owner 2026-08-31: *"don't guess."*
 */
export function HubProOffer({
  offer,
  channelName,
  priceLabel,
  base,
}: {
  offer: HubProOffer;
  /** The live channel's own name — "Save-the-Date", "RSVP", … */
  channelName: string | null;
  /** Already formatted from the live catalog, or null when it could not be read. */
  priceLabel: string | null;
  /** `/dashboard/<eventId>`. */
  base: string;
}) {
  return (
    <section
      aria-labelledby="hub-pro-offer-headline"
      className="mt-4 rounded-xl border border-dashed border-terracotta/50 bg-terracotta/[0.05] p-4 sm:p-5"
    >
      <p className="sn-eye">
        <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        {/* One unlock, one price, named once. The catalog's own title. */}
        Event Hub Pro{priceLabel ? ` · ${priceLabel}` : ''} · one unlock
      </p>
      <h3
        id="hub-pro-offer-headline"
        className="mt-1 text-base font-semibold tracking-tight text-ink"
      >
        {offer.headline}
      </h3>
      <p className="mt-1 max-w-prose text-sm text-ink/60">{offer.blurb}</p>

      {/* THE SEVEN, WITH THE ONE THEY ARE STANDING ON LIT. It is one price seven
          times, not seven prices — the other six say what else the same unlock
          opens, which is the whole reason there is no per-feature buy button. */}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {offer.chips.map((chip) => (
          <li
            key={chip.name}
            className={
              chip.here
                ? 'rounded-full bg-terracotta-700 px-2.5 py-1 text-[11px] font-semibold text-cream'
                : 'rounded-full border border-terracotta/40 px-2.5 py-1 text-[11px] text-ink/60'
            }
          >
            {chip.name}
            {chip.here && (
              <span className="sr-only">
                {' '}— the one missing from your {channelName ?? 'page'}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`${base}${offer.ctaPath}`} className="button-primary inline-flex">
          {offer.ctaLabel}
        </Link>
        <Link
          href={`${base}/website/editor`}
          className="inline-flex items-center rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          What&rsquo;s included
        </Link>
      </div>
    </section>
  );
}
