/**
 * THE BOOKED BODY — the third mode of the Suppliers page (owner 2026-10-07;
 * corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR4; the prototype's
 * Booked mode).
 *
 *   Waiting for their yes   ⓘ   N asked · nothing opens until they agree
 *   Booked                      N booked · N without a price
 *   Budget                      (its own slot — `children`)
 *
 * A SERVER component: headings, counts and the sentences are plain HTML; only
 * a row is a client island (`booked-row.tsx`), because a row folds open and its
 * verbs call actions. Everything it says is decided in `lib/booked-rows.ts`.
 *
 * Three states of the list, never confused for each other:
 *   · `unreadable` — the team read was refused → "Couldn't load your suppliers".
 *   · nothing booked — a real, measured empty list → the prototype's own line.
 *   · rows.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import {
  BOOKED_EMPTY,
  WAITING_HEADING,
  WAITING_INFO,
  type BookedView,
} from '@/lib/booked-rows';
import { BookedRowItem, WaitingRowItem } from './booked-row';

/** Hairline rows, no boxes; a row's details fold open in place. */
const BOOKED_CSS =
  '[data-booked-body] .bk-row{border-top:1px solid rgb(var(--color-ink)/.1);padding:12px 0;min-width:0}' +
  '[data-booked-body] .bk-rows>.bk-row:first-child{border-top:0}' +
  '[data-booked-body] .bk-row>button{min-height:44px}' +
  '[data-booked-body] .bk-exp{display:grid;grid-template-rows:0fr;transition:grid-template-rows .28s cubic-bezier(.2,.7,.2,1)}' +
  '[data-booked-body] .bk-exp>div{overflow:clip;min-width:0}' +
  '[data-booked-body] .bk-row[data-open] .bk-exp{grid-template-rows:1fr}' +
  '[data-booked-body] .bk-verbs{position:relative;display:flex;flex-wrap:nowrap;align-items:center;gap:8px;min-width:0}' +
  '[data-booked-body] .bk-slot{display:contents}' +
  // ONE button height (40 px). A <button> picks up the app's 44 px touch floor and
  // an <a> does not, so a row of both stood at two heights (measured in the lab
  // at 375: Pay 44, Chat 40) — the fault the Find walk fixed for its own rows.
  '[data-booked-body] :is(button,a).ab{height:40px;min-height:0}' +
  // A main verb that does not shout: the tone as a wash and a word, not a fill.
  '[data-booked-body] :is(button,a).ab.ab-main.bk-soft{background:color-mix(in srgb,rgb(var(--ab-tone)) 12%,transparent);color:rgb(var(--ab-word))}' +
  '[data-booked-body] .bk-verbs .bk-said{position:absolute;left:0;right:0;top:100%;margin-top:4px}' +
  '[data-booked-body] .bk-verbs:has(.bk-said){margin-bottom:22px}' +
  '@media (prefers-reduced-motion:reduce){[data-booked-body] .bk-exp{transition:none}}';

const H2 = 'font-display text-[21px] font-medium leading-tight text-ink';
const SUB = 'mt-0.5 text-[14px] text-ink/60';

export type BookedBodyState =
  | { kind: 'unreadable'; retryHref: string }
  | { kind: 'view'; view: BookedView };

export function BookedBody({
  eventId,
  state,
  dateChangeUnread = false,
  children,
}: {
  eventId: string;
  state: BookedBodyState;
  /** The date-change read was refused — said once, never drawn as "no request". */
  dateChangeUnread?: boolean;
  /** The Budget section, under the rows. */
  children?: ReactNode;
}) {
  if (state.kind === 'unreadable') {
    return (
      <div data-booked-body="unreadable" role="alert" className="py-2">
        <p className="text-sm font-semibold text-ink">Couldn’t load your suppliers</p>
        <p className="mt-1 text-[12.5px] text-ink/60">This is a loading problem — not an empty list.</p>
        <Link
          href={state.retryHref}
          className="-ml-1.5 mt-3 inline-flex min-h-[44px] items-center rounded-md px-1.5 text-[12.5px] font-semibold text-mulberry"
        >
          Try again ›
        </Link>
      </div>
    );
  }

  const { waiting, booked, unpriced } = state.view;
  return (
    <div data-booked-body="view" className="space-y-7">
      <style>{BOOKED_CSS}</style>

      {waiting.length > 0 ? (
        <section data-booked-section="waiting" aria-labelledby="bk-waiting-h">
          <InfoTip label={WAITING_HEADING} labelAs="h2" labelId="bk-waiting-h" labelClassName={H2} align="start">
            {WAITING_INFO}
          </InfoTip>
          <p className={SUB}>{formatCount(waiting.length)} asked · nothing opens until they agree</p>
          <ul className="bk-rows mt-2">
            {waiting.map((r) => (
              <WaitingRowItem key={r.vendorId} eventId={eventId} row={r} />
            ))}
          </ul>
        </section>
      ) : null}

      <section data-booked-section="booked" aria-labelledby="bk-booked-h">
        <h2 id="bk-booked-h" className={H2}>
          Booked
        </h2>
        {booked.length === 0 ? (
          <p className={SUB} data-booked-empty="">
            {BOOKED_EMPTY}
          </p>
        ) : (
          <>
            <p className={SUB}>
              {formatCount(booked.length)} booked
              {unpriced > 0 ? (
                <>
                  {' · '}
                  <span className="font-medium text-mulberry">{formatCount(unpriced)} without a price</span>
                </>
              ) : null}
            </p>
            {dateChangeUnread ? (
              <p className="mt-1 text-[12.5px] text-ink/60" role="status" data-booked-date-unread="">
                We couldn’t check whether a date change is waiting.
              </p>
            ) : null}
            <ul className="bk-rows mt-2">
              {booked.map((r) => (
                <BookedRowItem key={r.vendorId} eventId={eventId} row={r} />
              ))}
            </ul>
          </>
        )}
      </section>

      {children}
    </div>
  );
}
