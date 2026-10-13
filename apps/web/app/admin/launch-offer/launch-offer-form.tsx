'use client';

import { useActionState } from 'react';
import { saveLaunchOffer, type LaunchOfferActionState } from './actions';

/**
 * The launch offer's numbers and its free-fee window — two small forms on the
 * one page (owner 2026-10-08: "ONE admin page"). Each field is a Form row: its
 * name above, a pill box, the plain-words answer under the main button
 * (INTERACTION_RULES § 9). The main button is terracotta.
 */
const MAIN =
  'inline-flex min-h-[44px] items-center justify-center rounded-full bg-mulberry px-5 text-sm font-semibold text-cream transition hover:bg-mulberry-600';
const SECOND =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border border-ink/20 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/40';
const FIELD = 'input-field mt-1 w-full rounded-full text-right tabular-nums';

function Result({ state }: { state: LaunchOfferActionState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
      {state.message}
    </p>
  );
}

export function LaunchOfferNumbersForm({
  cap,
  papicCredits,
  cycleDays,
  enabled,
  closed,
}: {
  cap: number | null;
  papicCredits: number | null;
  cycleDays: number | null;
  enabled: boolean;
  closed: boolean;
}) {
  const [state, formAction] = useActionState<LaunchOfferActionState, FormData>(saveLaunchOffer, {
    ok: false,
    message: null,
  });
  return (
    <form action={formAction} className="sn-tile p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block" htmlFor="launch_offer_booking_cap">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Fee-free bookings
          </span>
          <input
            id="launch_offer_booking_cap"
            name="launch_offer_booking_cap"
            type="number"
            min="1"
            step="1"
            defaultValue={cap ?? ''}
            className={FIELD}
          />
        </label>
        <label className="block" htmlFor="launch_offer_papic_credits">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Papic credits per booking
          </span>
          <input
            id="launch_offer_papic_credits"
            name="launch_offer_papic_credits"
            type="number"
            min="0"
            step="1"
            defaultValue={papicCredits ?? ''}
            className={FIELD}
          />
        </label>
        <label className="block" htmlFor="launch_offer_cycle_days">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Subscription cycle (days)
          </span>
          <input
            id="launch_offer_cycle_days"
            name="launch_offer_cycle_days"
            type="number"
            min="1"
            step="1"
            defaultValue={cycleDays ?? ''}
            className={FIELD}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!enabled && !closed ? (
          <button type="submit" name="intent" value="start" className={MAIN}>
            Start the launch offer
          </button>
        ) : (
          <button type="submit" name="intent" value="save" className={MAIN}>
            Save
          </button>
        )}
        {enabled && !closed ? (
          <button type="submit" name="intent" value="close" className={SECOND}>
            End it now
          </button>
        ) : null}
      </div>
      <div className="mt-2">
        <Result state={state} />
      </div>
    </form>
  );
}

export function FreeFeeWindowForm({ from, until }: { from: string; until: string }) {
  const [state, formAction] = useActionState<LaunchOfferActionState, FormData>(saveLaunchOffer, {
    ok: false,
    message: null,
  });
  return (
    <form action={formAction} className="sn-tile p-4">
      <input type="hidden" name="intent" value="window" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block" htmlFor="booking_fee_free_from">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Free from (Manila time)
          </span>
          <input
            id="booking_fee_free_from"
            name="booking_fee_free_from"
            type="datetime-local"
            defaultValue={from}
            className="input-field mt-1 w-full rounded-full"
          />
        </label>
        <label className="block" htmlFor="booking_fee_free_until">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Free until (Manila time)
          </span>
          <input
            id="booking_fee_free_until"
            name="booking_fee_free_until"
            type="datetime-local"
            defaultValue={until}
            className="input-field mt-1 w-full rounded-full"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="submit" className={MAIN}>
          Save the free-fee window
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}
