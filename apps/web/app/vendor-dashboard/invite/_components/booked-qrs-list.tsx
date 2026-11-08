'use client';

import { useState } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { DatesRow } from '../../customers/_components/dates-row';
import { issueLockedQr } from '../actions';

/** One Booked QR as the list draws it (the page's ledger row — `IssuedRow`). */
export type BookedQrRow = {
  token: string;
  title: string;
  line: string;
  status: 'pending' | 'claimed' | 'void';
  /** Waiting → change it (void + reissue) · Used → that client's Details · Deleted → nothing. */
  openHref: string | null;
};

/** The three groups, in the order the owner named them. */
export const BOOKED_QR_GROUPS = [
  { status: 'pending', word: 'Waiting', badge: { tone: 'wait', word: 'Waiting' } },
  { status: 'claimed', word: 'Used', badge: { tone: 'ok', word: 'Used' } },
  { status: 'void', word: 'Deleted', badge: { tone: 'quiet', word: 'Deleted' } },
] as const;

/**
 * 🎟 THE BOOKED QRs LIST (Supplier Build 2 row #34 — the shipped ledger, completed; owner: *"track and delete a QR…
 * see updates of the custom QR's"*). Waiting · Used · Deleted, each under its own heading:
 *   · tap a WAITING code → change it (the form opens filled; saving voids the old code and makes a new one);
 *   · swipe a waiting code left → Delete, with Undo (the shipped `SwipeToDelete` + `deleteWithUndo`: the row hides at
 *     once and the void is written when the Undo window closes; a refusal brings it back and says why);
 *   · tap a USED code → that client (its Details);
 *   · a DELETED code is history — no door, no swipe.
 */
/** Delete (void) one waiting code through the shipped `issueLockedQr` — its `void_token` mode (see there for why). */
function voidCode(token: string): Promise<void> {
  const fd = new FormData();
  fd.set('void_token', token);
  return issueLockedQr(fd);
}

export function BookedQrsList({ rows }: { rows: readonly BookedQrRow[] }) {
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const hide = (t: string, on: boolean) =>
    setGone((cur) => {
      const next = new Set(cur);
      if (on) next.add(t);
      else next.delete(t);
      return next;
    });
  return (
    <>
      <UndoToastHost />
      {BOOKED_QR_GROUPS.map((g) => {
        const mine = rows.filter((r) => r.status === g.status && !gone.has(r.token));
        if (mine.length === 0) return null;
        return (
          <section key={g.status} data-booked-qrs-group={g.status}>
            <h3 className="pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/60">
              {g.word} · {mine.length}
            </h3>
            {mine.map((r) => {
              const row = <DatesRow data="booked-qr" title={r.title} line={r.line} badge={g.badge} href={r.openHref} />;
              if (r.status !== 'pending') return <div key={r.token}>{row}</div>;
              return (
                <SwipeToDelete
                  key={r.token}
                  label={`Delete the code for ${r.title}`}
                  onDelete={() =>
                    deleteWithUndo({
                      label: `Code for ${r.title} deleted.`,
                      hide: () => hide(r.token, true),
                      restore: () => hide(r.token, false),
                      commit: () => voidCode(r.token),
                      failed: 'Couldn’t delete that code. It’s back — try again.',
                    })
                  }
                >
                  {row}
                </SwipeToDelete>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
