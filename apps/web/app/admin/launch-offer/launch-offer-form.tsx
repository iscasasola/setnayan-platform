'use client';

import { useActionState } from 'react';
import { Check, Play, Square } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormRow, FormRows } from '@/app/_components/form-row';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import { FREE_FEE_REASON_MAX } from '@/lib/launch-offer';
import { saveLaunchOffer, type LaunchOfferActionState } from './actions';

/**
 * The launch offer's numbers and its free-fee window — two small forms on the
 * one page (owner 2026-10-08: "ONE admin page"). Each field is a Form row: its
 * name above, a pill box, the plain-words answer under the main button
 * (INTERACTION_RULES § 9). The main button is terracotta — the house `ActionButton`; its `formName` posts `intent`
 * (controller, 16 Nov 2026: a form-name apart from the accessible name).
 */
const FIELD = 'input-field w-[150px] flex-none rounded-full text-right tabular-nums';
/** 📐 Admin clean port (19 Nov 2026): each field is a Form row in ONE frame — no tile, no mono capitals. */
const FRAME = `${ADMIN_FRAME} px-4 py-2`;
const DATE_FIELD = 'input-field w-[220px] max-w-full flex-none rounded-full';

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
    <form action={formAction} className={FRAME}>
      <FormRows width="short">
        <FormRow name="Fee-free bookings">
          <input
            id="launch_offer_booking_cap"
            aria-label="Fee-free bookings"
            name="launch_offer_booking_cap"
            type="number"
            min="1"
            step="1"
            defaultValue={cap ?? ''}
            className={FIELD}
          />
        </FormRow>
        <FormRow name="Papic credits per booking">
          <input
            id="launch_offer_papic_credits"
            aria-label="Papic credits per booking"
            name="launch_offer_papic_credits"
            type="number"
            min="0"
            step="1"
            defaultValue={papicCredits ?? ''}
            className={FIELD}
          />
        </FormRow>
        <FormRow name="Subscription cycle (days)">
          <input
            id="launch_offer_cycle_days"
            aria-label="Subscription cycle (days)"
            name="launch_offer_cycle_days"
            type="number"
            min="1"
            step="1"
            defaultValue={cycleDays ?? ''}
            className={FIELD}
          />
        </FormRow>
      </FormRows>
      <div className="mt-2 flex flex-wrap items-center gap-2 pb-2">
        {!enabled && !closed ? (
          <ActionButton tone="brand" main icon={Play} type="submit" formName="intent" value="start" label="Start the launch offer" />
        ) : (
          <ActionButton tone="brand" main icon={Check} type="submit" formName="intent" value="save" label="Save" />
        )}
        {enabled && !closed ? (
          <ActionButton tone="neutral" icon={Square} type="submit" formName="intent" value="close" label="End it now" />
        ) : null}
      </div>
      <div className="pb-2">
        <Result state={state} />
      </div>
    </form>
  );
}

/**
 * 🔑 A WINDOW NEEDS ITS REASON TO OPEN, NOT TO CLOSE (DECISION_LOG 2026-09-23
 * #3) — so the box is not `required` in HTML (clearing both dates must still
 * save); `saveLaunchOffer` refuses an open window without one.
 */
export function FreeFeeWindowForm({ from, until, reason }: { from: string; until: string; reason: string }) {
  const [state, formAction] = useActionState<LaunchOfferActionState, FormData>(saveLaunchOffer, {
    ok: false,
    message: null,
  });
  return (
    <form action={formAction} className={FRAME}>
      <input type="hidden" name="intent" value="window" />
      <FormRows width="wide">
        <FormRow name="Free from (Manila time)">
          <input
            id="booking_fee_free_from"
            aria-label="Free from (Manila time)"
            name="booking_fee_free_from"
            type="datetime-local"
            defaultValue={from}
            className={DATE_FIELD}
          />
        </FormRow>
        <FormRow name="Free until (Manila time)">
          <input
            id="booking_fee_free_until"
            aria-label="Free until (Manila time)"
            name="booking_fee_free_until"
            type="datetime-local"
            defaultValue={until}
            className={DATE_FIELD}
          />
        </FormRow>
        {/* ⚠ Kept a raw box on purpose: `a-free-fee-window-needs-its-reason.test.ts` pins the literal
            `name="booking_fee_free_reason"`, and the stored reason must load back into it (`defaultValue`). */}
        <FormRow name="Reason" note="Needed to open a window — kept with the change.">
          <input
            id="booking_fee_free_reason"
            aria-label="Reason"
            name="booking_fee_free_reason"
            type="text"
            maxLength={FREE_FEE_REASON_MAX}
            defaultValue={reason}
            className="input-field w-[220px] max-w-full flex-none rounded-full"
          />
        </FormRow>
      </FormRows>
      <div className="mt-2 flex flex-wrap items-center gap-2 pb-2">
        <ActionButton tone="brand" main icon={Check} type="submit" label="Save the free-fee window" />
        <Result state={state} />
      </div>
    </form>
  );
}

/**
 * 🎂 The special tools' start date — before it every plan has the Cake Maker; from it, Pro and up (owner ruling
 * "SPECIAL TOOLS ARE INCLUDED IN SUPPLIER PRO AND UP"). Empty = open to every plan.
 */
export function SpecialToolsDateForm({ from }: { from: string }) {
  const [state, formAction] = useActionState<LaunchOfferActionState, FormData>(saveLaunchOffer, {
    ok: false,
    message: null,
  });
  return (
    <form action={formAction} className="border-t border-ink/10 pt-4">
      <input type="hidden" name="intent" value="special_tools" />
      <label className="block" htmlFor="special_tools_paid_from">
        <span className="text-xs font-medium text-ink/70">Pro and up from (Manila time)</span>
        <input
          id="special_tools_paid_from"
          name="special_tools_paid_from"
          type="datetime-local"
          defaultValue={from}
          className="input-field mt-1 w-full rounded-full"
        />
        <span className="mt-1 block text-xs text-ink/60">Until then the Cake Maker is open to every plan. Leave empty to keep it open.</span>
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ActionButton tone="brand" main icon={Check} type="submit" label="Save the date" />
        <Result state={state} />
      </div>
    </form>
  );
}
