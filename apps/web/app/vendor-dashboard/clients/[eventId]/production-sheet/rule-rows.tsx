'use client';

import { useRef } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { StayForm } from '@/app/_components/stay-form';
import { formatCount } from '@/lib/format-number';
import { deletePortionRule } from './actions';
import s from '@/app/vendor-dashboard/_components/set-two/set-two.module.css';

export type RuleRow = {
  ruleId: string;
  label: string;
  perGuest: string;
  buffer: string | null;
  basisNote: string;
  count: number;
  /** The rule's result, already worded with its commas and unit ("58 kg"). */
  yieldWords: string;
};

/**
 * The portion rules as rows (supplier pages set two, page 5): on a phone each rule is one row — its name, its working on
 * the second line, the total at the right — and a swipe left shows Delete; from 701 the same rows line up as the table's
 * five columns and Delete shows on hover. The one swipe (`SwipeToDelete`), the shipped delete action.
 */
export function RuleRows({ eventId, rows }: { eventId: string; rows: readonly RuleRow[] }) {
  return (
    <div role="table" aria-label="Ingredient totals" data-production-rules="">
      <div role="row" className="hidden px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--m-slate-2)] tab:grid tab:grid-cols-[1.2fr_1fr_1.6fr_0.6fr_0.8fr] tab:gap-2">
        <span role="columnheader">Item</span>
        <span role="columnheader">Per guest</span>
        <span role="columnheader">Who counts</span>
        <span role="columnheader" className="text-right">Guests</span>
        <span role="columnheader" className="text-right">Total</span>
      </div>
      {rows.map((r) => (
        <RuleRowItem key={r.ruleId} eventId={eventId} r={r} />
      ))}
    </div>
  );
}

/** One rule: the row the swipe (or the hover Delete) acts on, and the door its Delete posts through (a stay form). */
function RuleRowItem({ eventId, r }: { eventId: string; r: RuleRow }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <>
      <StayForm ref={form} door="supClients.deletePortionRule" action={deletePortionRule} className="hidden">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="rule_id" value={r.ruleId} />
      </StayForm>
      <SwipeToDelete label={`Delete ${r.label}`} word="Delete" hover onDelete={() => form.current?.requestSubmit()}>
        <div role="row" className={`${s.row} tab:!grid tab:grid-cols-[1.2fr_1fr_1.6fr_0.6fr_0.8fr] tab:gap-2`}>
          <span role="cell" className={s.rowBody}>
            <b className={s.rowTitle}>{r.label}</b>
            <span className={`${s.rowSub} tab:!hidden`}>
              {r.perGuest}
              {r.buffer ? ` ${r.buffer}` : ''} · {r.basisNote} · {formatCount(r.count)}
            </span>
          </span>
          <span role="cell" className="hidden text-[13px] tabular-nums tab:block">
            {r.perGuest}
            {r.buffer ? <span className="text-[color:var(--m-slate-2)]"> {r.buffer}</span> : null}
          </span>
          <span role="cell" className="hidden text-[13px] text-[color:var(--m-slate-2)] tab:block">
            {r.basisNote}
          </span>
          <span role="cell" className="hidden text-right text-[13px] tabular-nums tab:block">
            {formatCount(r.count)}
          </span>
          <span role="cell" className={s.rowEnd}>
            {r.yieldWords}
          </span>
        </div>
      </SwipeToDelete>
    </>
  );
}
