/**
 * own-supplier-items.ts — the suppliers already on your events, as search rows.
 *
 * Owner, 22 Oct 2026, on his iPhone, signed in: he searched "seda" — Seda
 * Vertis North, a supplier he has BOOKED on his own event, added by hand and
 * never published — and was told *"No suppliers match exactly"* on a page
 * outside the app. *"I tried to search for seda and brought me here away from
 * our shell."*
 *
 * 🔑 THE INDEX HELD NO SUPPLIERS AT ALL. The palette searched events, spaces
 * and jump links; the page it handed you to searched only PUBLISHED shops. A
 * supplier on your own event lives in neither, so the one supplier you were
 * most sure of was the one search could never find.
 *
 * ─── THE RULE ───────────────────────────────────────────────────────────
 * Every supplier row on an event you ORGANISE — booked, considering, added by
 * hand, with or without a Setnayan account, published or not — is a row in
 * your search, tagged "On your event", opening that supplier's own room on
 * that event. Only rows the couple put away (`archived_at`, replaced by a
 * package lock) are left out, because the Suppliers page no longer shows them.
 *
 * 🔒 PRIVACY IS A CONSEQUENCE, NOT A FILTER (DECISION_LOG 2026-09-23). These
 * are rows the couple's own RLS already lets them read, under the name their
 * own Suppliers page already prints (`event_vendors.vendor_name`). Searching
 * them shows nothing the couple could not reach by browsing their event. The
 * MARKETPLACE half of the answer is a different read with its own publish gate
 * (`searchLiveShops` → `LIVE_SHOP_GATE`) and is untouched.
 *
 * Pure on purpose: the read lives in `command-data.ts` (server-only); this is
 * the decision, so a guard can run it (`own-supplier-items.test.ts`).
 */
import type { HomeCommandItem } from '@/app/dashboard/(launcher)/_components/home-command-bar';

/** The tag a supplier row wears everywhere it is drawn — one string, one place. */
export const ON_YOUR_EVENT = 'On your event';

/** The `event_vendors` columns this reads (the select lives in `command-data.ts`). */
export type OwnSupplierRow = {
  vendor_id: string;
  event_id: string;
  vendor_name: string | null;
  archived_at?: string | null;
};

export type OwnSupplierEvent = { event_id: string; display_name: string };

/** The supplier's own room on that event — `[vendorId]` is the event_vendors PK. */
export function ownSupplierHref(eventId: string, vendorId: string): string {
  return `/dashboard/${eventId}/vendors/${vendorId}/workspace`;
}

export function ownSupplierItems(
  events: readonly OwnSupplierEvent[],
  rows: readonly OwnSupplierRow[],
): HomeCommandItem[] {
  const nameOf = new Map(events.map((e) => [e.event_id, e.display_name]));
  const out: HomeCommandItem[] = [];
  for (const r of rows) {
    // Only YOUR events: a row for an event this person does not organise has no
    // room they can open (the couple dashboard admits organisers only).
    const eventName = nameOf.get(r.event_id);
    if (eventName === undefined) continue;
    if (r.archived_at) continue;
    const name = r.vendor_name?.trim();
    // A row with no name has nothing a person could type to find it.
    if (!name) continue;
    out.push({
      id: `supplier-${r.vendor_id}`,
      label: name,
      sublabel: `${ON_YOUR_EVENT} · ${eventName}`,
      href: ownSupplierHref(r.event_id, r.vendor_id),
      kind: 'supplier',
      icon: 'store',
    });
  }
  return out;
}
