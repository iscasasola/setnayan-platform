import { displayServiceLabel } from '@/lib/vendors';
import type { Snapshot } from '@/lib/service-card-snapshot';

/**
 * offered-service-card-decide.ts — the DECISION behind the card a supplier
 * offers inside a conversation, with no I/O in it at all.
 *
 * ── WHY IT IS ITS OWN MODULE ───────────────────────────────────────────────
 * Its sibling `offered-service-card.ts` is `server-only` (it signs R2 refs and
 * uses the admin client), and a `server-only` module cannot be imported by
 * `tsx --test` — which is why so many guards in this repo are source scans that
 * prove wiring and never prove behaviour. The two things here that can be got
 * wrong in a way somebody FEELS — showing a rival supplier's card, and calling
 * a real service "Untitled service" — are decided in this file precisely so a
 * test can execute them instead of grepping for them.
 *
 * Pure: no reads, no writes, no signing, no React.
 */

export type OfferedServiceCardData = {
  serviceId: string;
  /** Title if the supplier set one, else the category read as English. */
  name: string;
  /** Category read as English — the subtitle, omitted when it IS the name. */
  categoryLabel: string | null;
  priceText: string;
  discountBadge: string | null;
  includesLine: string | null;
  notIncluded: string[];
  hasExclusive: boolean;
  /** The supplier said yes to the Setnayan gift — see Snapshot for why the two
   *  are separate facts and not one. */
  givesSetnayanGift: boolean;
  /** Presigned cover photo, or null when the supplier never set one. */
  coverUrl: string | null;
  /** Presigned showcase clip (≤30s), or null when there is none. */
  clipUrl: string | null;
};

export type OfferedServiceCardResult =
  | { status: 'ok'; card: OfferedServiceCardData }
  /** No such message, or the viewer is not a party to that conversation. */
  | { status: 'not_found' }
  /** The read was REFUSED or errored. Never render this as "no card". */
  | { status: 'error' };

/**
 * The whole DECISION, with no I/O in it: who this card may be shown to, and
 * what it is called.
 *
 * Split out so both halves can actually be executed by a test. The async
 * resolver below is the reads around it; everything that can be got WRONG in a
 * way a couple or a rival supplier would feel is decided here.
 */
export function decideOfferedServiceCard(input: {
  /** vendor_profile_id on the MESSAGE — i.e. whose conversation this is. */
  threadVendorProfileId: string;
  /** vendor_profile_id on the SERVICE the message names. */
  serviceVendorProfileId: string;
  title: string | null;
  category: string | null;
  snapshot: Snapshot;
  coverUrl: string | null;
  clipUrl: string | null;
  serviceId: string;
}): OfferedServiceCardResult {
  // ⛔ THE REFUSAL. `authenticated` holds INSERT on `offered_service_id`
  // (it must — the supplier writes the row under their own session), so a
  // COUPLE can post a message naming ANY service id, including a rival
  // supplier's. RLS cannot refuse that: it is row-level, never value-level.
  // This comparison is the entire defence. Delete it and any thread becomes a
  // viewer for arbitrary suppliers' media and pricing.
  if (input.serviceVendorProfileId !== input.threadVendorProfileId) {
    return { status: 'not_found' };
  }

  const categoryLabel = input.category ? displayServiceLabel(input.category) : null;
  const title = input.title?.trim();
  // ⚠ NOT `snapshot.name`. `readSnapshot` falls back to "Untitled service", and
  // measured on production 2026-09-09 `title` is NULL on BOTH live services —
  // so taking it would have printed "Untitled service" on every card that
  // ships today, where the chip row it replaces printed "Live band". The chip
  // and the card resolve the name through the same two steps so they cannot
  // disagree.
  const name = title || categoryLabel || 'Service';

  return {
    status: 'ok',
    card: {
      serviceId: input.serviceId,
      name,
      // When the category IS the name there is nothing to add underneath it.
      categoryLabel: categoryLabel && categoryLabel !== name ? categoryLabel : null,
      priceText: input.snapshot.priceText,
      discountBadge: input.snapshot.discountBadge,
      includesLine: input.snapshot.includesLine,
      notIncluded: input.snapshot.notIncluded,
      hasExclusive: input.snapshot.hasExclusive,
      givesSetnayanGift: input.snapshot.givesSetnayanGift,
      coverUrl: input.coverUrl,
      clipUrl: input.clipUrl,
    },
  };
}

