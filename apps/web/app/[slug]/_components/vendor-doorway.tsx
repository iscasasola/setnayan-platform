import Link from 'next/link';
import { Briefcase, ArrowRight } from 'lucide-react';
import type { VendorCapability } from '../_lib/site-identity';
import type { SupplierDeskModel } from '../_lib/supplier-desk.server';
import type { ClientEventWords } from './event-words-provider';
import { SupplierDesk } from './supplier-desk';
import { SUPPLIER_DESK_ANCHOR } from './supplier-ribbon';

/**
 * VendorDoorway — the strip a booked supplier sees on their client's own
 * wedding page, pointing at their tools for THIS event.
 *
 * ── THE GAP IT CLOSES ───────────────────────────────────────────────────────
 * Until now the couple's link treated a booked photographer, band or emcee as
 * a stranger. Their run of show, their cues and their call time all exist —
 * in their own workspace — and nothing on the wedding site pointed at any of
 * it, so a supplier had to be sent a separate long address out of band. The
 * project's own wayfinding rule calls a shipped surface with no doorway a
 * defect; this is that defect, for the whole supplier side.
 *
 * ── A DOOR, NOT A ROOM — EXCEPT ON THE DAY (2026-08-27) ─────────────────────
 * It LINKS OUT rather than rendering anything. A supplier works many weddings;
 * their week, their invoices and their other clients do not belong inside one
 * couple's page. So the strip is deliberately a single line and a link — the
 * couple's site stays the couple's.
 *
 * 🔑 THAT REASONING SURVIVES; ONLY ITS CONCLUSION NARROWS. Owner, 2026-08-27:
 * *"on the day. is the integration of the vendors to the event's event hub. so
 * we would still want to to be an event hub"*, and — before a line was written —
 * *"we are redesigning not placing a new page."* So there is NO second product
 * and no new route: this same strip in this same place renders `SupplierDesk`
 * instead of a link.
 *
 * ⏳ AND IT IS NOT ONLY THE DAY ANY MORE. S3 opened the desk on the day and shut
 * it at six the next morning — thirty hours of a booking's life — and the
 * binding design's own strongest sentence is against that: *"a day-only room
 * recreates the midnight-door mistake."* The desk now has four states (call
 * sheet · today · look back · the quiet line), so the door is open whenever a
 * supplier looks. What did NOT widen is who may open it: `VendorCapability` is
 * the same gate it always was, and the plain link below is still what a
 * supplier gets when the desk cannot be built honestly.
 *
 * The boundary the desk is held to is unchanged — THIS event's facts and tools,
 * and nothing about their week, their invoices or their other clients.
 *
 * ── WHY IT IS SAFE ──────────────────────────────────────────────────────────
 * It renders ONLY from a `VendorCapability`, which is produced solely by
 * `resolveVendorCapability` after the database confirmed this auth user owns a
 * vendor profile the couple booked on THIS event. A compile-time assertion in
 * site-identity.ts proves neither identity tier can carry those keys, so no
 * visitor can smuggle one in through the body tree. There is no client input
 * on this path.
 *
 * It also carries NOTHING about the event — the couple's own page is already
 * on screen — so the strip cannot become a second, unaudited leak of event
 * data to a supplier.
 */
export function VendorDoorway({
  capability,
  desk,
  words,
}: {
  capability: VendorCapability;
  /** Non-null whenever the celebration has a date AND every content read under
   *  the supplier's own session succeeded. Null when the desk could not be
   *  built honestly — in which case the supplier loses the desk and keeps the
   *  door, never the other way round. */
  desk?: SupplierDeskModel | null;
  /** The celebration's own words, for the one sentence the desk says about the
   *  people throwing it. A wake does not have a couple. */
  words: ClientEventWords;
}) {
  if (desk) return <SupplierDesk desk={desk} words={words} />;
  return (
    <aside
      id={SUPPLIER_DESK_ANCHOR}
      className="mx-auto mt-6 w-full max-w-3xl px-4"
      aria-label="Your supplier tools for this event"
    >
      <Link
        href={`/vendor-dashboard/clients/${capability.vendorEventId}`}
        className="group flex items-center gap-3 rounded-2xl border border-link/25 bg-link/[0.04] px-4 py-3 transition-colors hover:border-link/45"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-link/10 text-link">
          <Briefcase aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-xs font-bold uppercase tracking-[0.14em] text-link">
            You are booked here
          </span>
          <span className="block truncate text-sm text-ink/75">
            Open your tools for this event as{' '}
            <strong className="font-semibold text-ink">{capability.businessName}</strong>
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-link transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </Link>
    </aside>
  );
}
