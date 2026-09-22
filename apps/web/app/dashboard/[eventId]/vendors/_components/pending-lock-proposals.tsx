'use client';

import { useState, useTransition } from 'react';
import { Loader2, UserCheck, X } from 'lucide-react';
import { dismissVendorLockProposal, finalizeVendor } from '../actions';
import { capRows, hiddenMoreLabel } from '@/lib/capped-rows';

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
      } else if (res.status === 'vendor_not_verified') {
        // Booking-requires-verified gate (owner 2026-07-24).
        setNote(
          `${p.vendorName} is completing verification and can't be booked just yet.`,
        );
      } else if (res.status === 'error' || res.status === 'not_found') {
        setNote(`Couldn't lock ${p.vendorName}. Try from its card below.`);
      } else {
        // A gate (reservation terms / downpayment / slot / date / conflict)
        // needs the full lock flow — send the couple to the vendor's card.
        setNote(`${p.vendorName} needs a few details to lock — open its card below to finish.`);
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

  return (
    <section className="space-y-2 rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-4">
      <header className="flex items-center gap-1.5">
        <UserCheck aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta-700">
          Your coordinator proposed locking
        </p>
      </header>
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
      <ul className="divide-y divide-ink/10">
        {shown.map((p) => {
          const busy = isPending && busyId === p.id;
          return (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <p className="text-sm font-medium text-ink">{p.vendorName}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => confirmLock(p)}
                  disabled={busy}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <UserCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  Lock now
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(p)}
                  disabled={busy}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 disabled:opacity-60"
                >
                  <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Dismiss
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {more ? (
        <details>
          <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-700">
            {more}
          </summary>
          <ul className="mt-1 divide-y divide-ink/10">
            {items.slice(shown.length).map((p) => {
              const busy = isPending && busyId === p.id;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <p className="text-sm font-medium text-ink">{p.vendorName}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => confirmLock(p)}
                      disabled={busy}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-60"
                    >
                      {busy ? (
                        <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                      ) : (
                        <UserCheck aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                      Lock now
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(p)}
                      disabled={busy}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 disabled:opacity-60"
                    >
                      <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      Dismiss
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
      {note ? (
        <p role="status" className="text-xs text-ink/70">
          {note}
        </p>
      ) : null}
    </section>
  );
}
