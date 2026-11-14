import Link from 'next/link';

import { ShopCard } from '@/app/_components/frontdoor/front-door-feed';
import { toShopCardsFromRows } from '@/app/_components/frontdoor/data';
import { hasVerifiedBadge } from '@/lib/verified-badge';
import { logQueryError } from '@/lib/supabase/error-detect';
import { withShopArrival, type ShopArrival } from '@/lib/shop-back';
import {
  pickSimilarShops,
  similarShopsHeading,
  similarShopsSeeAllHref,
  type SimilarCandidate,
  type SimilarSelf,
} from '@/lib/similar-shops';
import type { SimilarShopRow } from '@/lib/similar-shops.server';

/**
 * 🏪 "More <kind of work> near <area>" — the second half of a shop page's new ending (owner 2026-11-14, DECISION_LOG
 * "A SHOP PAGE ENDS WITH ITS PARTNERS, THEN SIMILAR SHOPS NEARBY — APPROVED AS DRAWN"). Up to four of Discover's
 * shipped shop cards in a row (two rows of two on a phone), under the page's own small all-caps heading, with
 * "See all ›" into Discover's supplier view filtered to this kind of work.
 *
 * The rows arrive as a promise started early in the page (`rememberedSimilarShopRows`, ONE remembered read); which four
 * is `pickSimilarShops` (lib/similar-shops.ts). None → nothing is drawn, no empty message. A refused read → logged,
 * nothing drawn: the row makes no claim, so its absence cannot tell a lie.
 *
 * 🧭 A card carries the couple's ARRIVAL on (`withShopArrival`), the owner's call 3 on the drawing: back from a similar
 * shop returns to where the couple started (Discover, an event's Suppliers), exactly as the back arrow works today.
 */
export async function SimilarShopsRow({
  rows,
  service,
  kindLabel,
  self,
  excludeIds,
  arrival,
}: {
  /** null = this shop has no kind of work to match, or the read was not asked. A rejection = the read was refused. */
  rows: Promise<SimilarShopRow[] | null>;
  service: string;
  kindLabel: string;
  self: SimilarSelf;
  /** The Trusted-by shops — never repeated here. This shop is excluded by the rule itself. */
  excludeIds: readonly string[];
  arrival: ShopArrival;
}) {
  let read: SimilarShopRow[] | null;
  try {
    read = await rows;
  } catch (caught) {
    logQueryError('app/v/[slug]/_components/similar-shops-row.tsx: similar shops', caught, { service }, 'graceful_degrade');
    return null;
  }
  if (!read || read.length === 0) return null;

  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const candidates: Array<SimilarCandidate & { row: SimilarShopRow }> = read.map((row) => ({
    row,
    vendorProfileId: str(row.vendor_profile_id) ?? '',
    city: str(row.location_city),
    latitude: num(row.hq_latitude),
    longitude: num(row.hq_longitude),
    // The badge's own rule — the same fact the card draws.
    verified: hasVerifiedBadge({
      verification_state: str(row.verification_state),
      next_renewal_due_at: str(row.next_renewal_due_at),
    }),
    name: str(row.business_name) ?? '',
  }));
  const picked = pickSimilarShops(candidates, self, excludeIds);
  if (picked.shops.length === 0) return null;

  const cards = await toShopCardsFromRows(picked.shops.map((c) => c.row));
  if (cards.length === 0) return null;

  return (
    <section className="sn-shopend border-b border-ink/10 py-8" data-similar-shops="" aria-labelledby="similar-shops-heading">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="similar-shops-heading" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {similarShopsHeading(kindLabel, self.city, picked.near)}
        </h2>
        <Link
          href={similarShopsSeeAllHref(service)}
          className="inline-flex min-h-[44px] flex-none items-center whitespace-nowrap text-sm font-semibold text-ink/80 hover:text-ink"
          data-similar-see-all=""
        >
          See all ›
        </Link>
      </header>
      <div className="sn-shopend-grid">
        {cards.map((s) => (
          <ShopCard key={s.href} s={s} href={withShopArrival(s.href, arrival)} />
        ))}
      </div>
    </section>
  );
}
