'use client';

import { useActionState } from 'react';
import { setBookingsOpen, type BookingsOpenState } from './actions';

/**
 * 🚪 The bookings switch (owner 2026-11-02). One button: it says what pressing it does. `open` is the value read
 * on the server — NULL when the read failed, and then nothing is offered (an unread switch is not a closed one).
 */
export function BookingsOpenForm({ open }: { open: boolean | null }) {
  const [state, formAction] = useActionState<BookingsOpenState, FormData>(setBookingsOpen, { ok: false, message: null });
  if (open === null) return null;
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="bookings_open" value={open ? 'closed' : 'open'} />
      <button
        type="submit"
        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-mulberry px-5 text-sm font-semibold text-cream transition hover:bg-mulberry-600"
      >
        {open ? 'Close bookings' : 'Open bookings'}
      </button>
      {state.message ? (
        <p role="status" className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
