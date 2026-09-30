'use client';

import { useRef, useState, useTransition } from 'react';
import { submitRsvp } from '../actions';
import { PlusOneSeatPanels } from './rsvp-plus-ones';

/**
 * "ADD NAME" — IN PLACE, ON ME (prototype `rsvp_plus_ones_2026-09-29.html`,
 * frame E). Owner, 2026-09-29: *"plus guests are only minimum questions … They
 * also get their own QR Code."* And the standing rule: no link-outs — the
 * field is put right there, never "go edit it elsewhere".
 *
 *   · "Add name" on a TBA seat unfolds the SAME four boxes the reply uses
 *     (`PlusOneSeatPanels`: first name, last name, meal, dietary — nothing
 *     else), under the row, with "Save name" and "Cancel".
 *   · "Save name" goes through the guest's OWN save (`submitRsvp`, its
 *     `seat_names_only` branch — +0 server actions), which runs the reply's one
 *     seat rule: this guest's own seat only, the couple's switches re-read. The
 *     seat's row is named, its QR already exists, and the page re-renders the
 *     row NAMED — "Send their invite" · "Show <name>'s pass".
 *   · A failure keeps the boxes open and says so — never a closed form that
 *     looks saved (a thrown action's message is hidden in production, so the
 *     sentence is this file's own).
 */
export function AddNameInPlace({
  eventId,
  guestId,
  seatId,
  seatLabel,
  askMeal,
  askDietary,
}: {
  eventId: string;
  /** The BRINGER — the guest whose key this page holds. */
  guestId: string;
  /** The TBA seat's own guest row. */
  seatId: string;
  /** "+2" — numbered by seat. */
  seatLabel: string;
  askMeal: boolean;
  askDietary: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  // The reason, not a flag: the action RETURNS why a name did not save.
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const save = () => {
    const form = formRef.current;
    if (!form || !typed.trim()) return;
    const fd = new FormData(form);
    setFailed(null);
    startTransition(async () => {
      try {
        const res = await submitRsvp(eventId, guestId, fd);
        if (res && 'seatError' in res) setFailed(res.seatError);
        // Success re-renders this row as NAMED (the action revalidates the
        // page), which unmounts these boxes — nothing to close by hand.
      } catch {
        // Only a request that never came back lands here.
        setFailed('Their name did not save — check your connection and try again.');
      }
    });
  };

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="block min-w-0 truncate font-serif text-lg text-ink">{seatLabel} · TBA</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-add-name-in-place
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-gild px-4 text-sm font-medium text-ink"
        >
          Add name
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3" data-add-name-open>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-serif text-lg text-ink">
          {seatLabel} <small className="font-sans text-xs text-ink/60">TBA · adding their name</small>
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setFailed(null);
          }}
          className="inline-flex min-h-[44px] items-center px-2 text-sm text-ink/60 underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <input type="hidden" name="seat_names_only" value="1" />
        <PlusOneSeatPanels
          slots={[{ seatId, first: '', last: '', meal: 'no_preference', dietary: '' }]}
          active={0}
          arranged={false}
          askMeal={askMeal}
          askDietary={askDietary}
          idPrefix={`me-${seatId}-`}
          onName={(_i, full) => setTyped(full)}
        />
        {failed ? (
          <p role="alert" className="text-sm text-terracotta-700">
            {failed}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink/60">They get their own link and QR the moment you save.</p>
          <button
            type="submit"
            disabled={pending || !typed.trim()}
            className="button-primary min-h-[44px] px-5 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save name'}
          </button>
        </div>
      </form>
    </div>
  );
}
