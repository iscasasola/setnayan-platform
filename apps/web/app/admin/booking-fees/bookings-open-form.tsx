'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import { DoorClosed, DoorOpen, X } from 'lucide-react';

import { ActionButton, EqualRow } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { setBookingsOpen, type BookingsOpenState } from './actions';

/**
 * 🚪 The bookings switch (owner 2026-11-02), drawn as the design template's frame (2026-11-14, "Booking fees ·
 * after"): one button on the "Bookings are open ⓘ" row, red because it stops other people (rule 3). `open` is the
 * value read on the server — NULL when the read failed, and then nothing is offered (an unread switch is not a
 * closed one).
 *
 * CLOSING ASKS FIRST (rule 9: "are you sure?" only when it stops other people — closing bookings is the sheet's own
 * example): the sheet says what stops, what keeps going and what couples see, with Keep open · Close bookings at its
 * foot, equal widths. Opening them again needs no question.
 */
export function BookingsOpenForm({ open }: { open: boolean | null }) {
  const [state, formAction, pending] = useActionState<BookingsOpenState, FormData>(setBookingsOpen, { ok: false, message: null });
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const formId = useId();

  // The sheet closes once the save has answered — the result line then says what happened.
  useEffect(() => {
    if (state.message) setAsking(false);
  }, [state]);

  if (open === null) return null;
  return (
    <>
      <form id={formId} ref={formRef} action={formAction} className="contents">
        <input type="hidden" name="bookings_open" value={open ? 'closed' : 'open'} />
        {open ? (
          <ActionButton tone="danger" icon={DoorClosed} label="Close bookings" type="button" aria-haspopup="dialog" onClick={() => setAsking(true)} />
        ) : (
          <ActionButton tone="ok" icon={DoorOpen} label="Open bookings" type="submit" disabled={pending} />
        )}
      </form>
      {state.message ? (
        <p
          role="status"
          className="basis-full text-[13px]"
          style={{ color: state.ok ? 'rgb(var(--color-ok))' : 'rgb(var(--color-danger))' }}
        >
          {state.message}
        </p>
      ) : null}
      <Sheet open={asking} onClose={() => setAsking(false)} labelledById={titleId} rise>
        <div className="px-4 pb-5 pt-1">
          <div className="flex items-center gap-2">
            <h2 id={titleId} className="flex-1 text-[19px] font-extrabold text-ink">
              Close bookings?
            </h2>
            <ActionButton tone="neutral" icon={X} label="Close" iconOnly type="button" onClick={() => setAsking(false)} />
          </div>
          <dl className="mt-2 [&>div+div]:border-t [&>div+div]:border-[color:var(--m-line)]">
            <div className="flex min-h-14 flex-col justify-center py-2">
              <dt className="text-[15px] font-semibold text-ink">What stops</dt>
              <dd className="text-[13px] text-[color:var(--m-slate-2)]">Every new booking, for every verified shop</dd>
            </div>
            <div className="flex min-h-14 flex-col justify-center py-2">
              <dt className="text-[15px] font-semibold text-ink">What keeps going</dt>
              <dd className="text-[13px] text-[color:var(--m-slate-2)]">Bookings already made, fees already owed</dd>
            </div>
            <div className="flex min-h-14 flex-col justify-center py-2">
              <dt className="text-[15px] font-semibold text-ink">What couples see</dt>
              <dd className="text-[13px] text-[color:var(--m-slate-2)]">&ldquo;Bookings open soon&rdquo;</dd>
            </div>
          </dl>
          <EqualRow className="mt-4">
            <ActionButton tone="neutral" icon={DoorOpen} label="Keep open" type="button" onClick={() => setAsking(false)} />
            <ActionButton tone="danger" icon={DoorClosed} label="Close bookings" type="submit" form={formId} disabled={pending} />
          </EqualRow>
        </div>
      </Sheet>
    </>
  );
}
