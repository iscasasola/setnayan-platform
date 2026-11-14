'use client';

import { useState, useTransition } from 'react';
import { UserCheck, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { dismissVendorLockProposal, finalizeVendor } from '../actions';
import { capRows, hiddenMoreLabel } from '@/lib/capped-rows';
import { BOOKINGS_CLOSED_COUPLE_MESSAGE } from '@/lib/bookings-open';

export type PendingLockProposal = {
  id: number;
  eventVendorId: string;
  vendorName: string;
};

/**
 * Couple-facing "your coordinator proposed locking X" strip (corpus spec § 4).
 * Only rendered for the couple (the money-adjacent confirm is theirs). "Lock
 * now" fires the normal finalizeVendor as the couple; on a gate result
 * (reservation terms / downpayment / slot / date / conflict) it nudges the
 * couple to finish from the vendor's card. Rendered only when the propose-lock
 * flag is on and there are pending proposals.
 */
export function PendingLockProposals({
  eventId,
  proposals,
}: {
  eventId: string;
  proposals: PendingLockProposal[];
}) {
  const [items, setItems] = useState(proposals);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;
  const { shown, hiddenCount } = capRows(items);
  const more = hiddenMoreLabel(hiddenCount, 'proposals');

  function confirmLock(p: PendingLockProposal) {
    setBusyId(p.id);
    setNote(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('vendor_id', p.eventVendorId);
      const res = await finalizeVendor(fd);
      setBusyId(null);
      if (res.status === 'ok' || res.status === 'already_locked') {
        setItems((prev) => prev.filter((x) => x.id !== p.id));
      } else if (res.status === 'bookings_closed') {
        setNote(BOOKINGS_CLOSED_COUPLE_MESSAGE);
      } else if (res.status === 'vendor_not_verified') {
        // Booking-requires-verified gate (owner 2026-07-24).
        setNote(
          `${p.vendorName} is completing verification and can't be booked just yet.`,
        );
      } else if (res.status === 'error' || res.status === 'not_found') {
        setNote(`Couldn't book ${p.vendorName}. Try from its card below.`);
      } else {
        // A gate (reservation terms / downpayment / slot / date / conflict)
        // needs the full lock flow — send the couple to the vendor's card.
        setNote(`${p.vendorName} needs a few details to book — open its card below to finish.`);
      }
    });
  }

  function dismiss(p: PendingLockProposal) {
    setBusyId(p.id);
    setNote(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('proposal_id', String(p.id));
      await dismissVendorLockProposal(fd);
      setBusyId(null);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    });
  }

  /* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 11 · 13): a row that needs the couple — a gold edge, the name,
     the one thing to do now as the shared main button, Dismiss beside it as the quiet one. No card around the strip;
     its name is the section label in small grey capitals, not a typewriter caption. */
  const row = (p: PendingLockProposal) => {
    const busy = isPending && busyId === p.id;
    return (
      <li
        key={p.id}
        className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 border-l-2 border-terracotta py-2.5 pl-3"
      >
        <p className="text-[15px] font-semibold text-ink">{p.vendorName}</p>
        <div className="flex items-center gap-2">
          <ActionButton
            tone="brand"
            main
            icon={UserCheck}
            label={busy ? 'Booking…' : 'Book now'}
            name={`Book ${p.vendorName} now`}
            onClick={() => confirmLock(p)}
            disabled={busy}
          />
          <ActionButton
            tone="neutral"
            quiet
            icon={X}
            label="Dismiss"
            name={`Dismiss ${p.vendorName}`}
            onClick={() => dismiss(p)}
            disabled={busy}
          />
        </div>
      </li>
    );
  };

  return (
    <section className="space-y-1" data-pending-lock-proposals="">
      <h3 className="mt-[18px] text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
        Your coordinator proposed booking
      </h3>
      {/* ── CAPPED, 2026-09-22 ────────────────────────────────────────────
          This strip renders ABOVE `<ShortlistCategories>` in
          `vendors/page.tsx` and used to map the whole list. Owner: *"if i have
          100 vendors and i am inquire to all… i will not be able to see the
          bench anymore."* Measured in the approved prototype: the bench began
          4,806px down against 757px capped.

          🔑 THE REMAINDER FOLDS IN PLACE, IT IS NOT LINKED AWAY. Every row here
          is ACTIONABLE — "Lock now" is a money-adjacent confirm — so hiding one
          behind a route that does not exist would remove the couple's ability
          to answer it. A native `<details>` keeps all of them one tap away in
          the same strip, and needs no JavaScript to open.

          `hiddenMoreLabel` returns null for a zero remainder, so a list of
          exactly the ceiling length cannot render "…and 0 more". */}
      <ul className="divide-y divide-ink/10">{shown.map(row)}</ul>
      {more ? (
        <details>
          <summary className="flex min-h-12 cursor-pointer list-none items-center text-[14px] font-semibold text-mulberry">
            {more}
          </summary>
          <ul className="divide-y divide-ink/10">{items.slice(shown.length).map(row)}</ul>
        </details>
      ) : null}
      {note ? (
        <p role="status" className="text-[13px] text-ink/70">
          {note}
        </p>
      ) : null}
    </section>
  );
}
