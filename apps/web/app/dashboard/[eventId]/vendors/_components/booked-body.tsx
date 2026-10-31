/**
 * THE BOOKED BODY — the third mode of the Suppliers page (owner 2026-10-07;
 * corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR4; the prototype's
 * Booked mode).
 *
 *   [ Team ▾ ]  3 booked · 1 without a price      ← the Booked part's dropdown (Team · Budget · Schedule)
 *   Waiting for their yes   ⓘ   N asked · nothing opens until they agree
 *   Booked                      N booked · N without a price
 *   (one collapsed row each — ONE open at a time, `BookedRowList`)
 *
 * The approved final Suppliers design (owner 2026-10-30): Booked = Team · Budget · Schedule, ONE dropdown on the
 * body's first row (`BookedPartRow`); the Budget and the Schedule are their own parts (`lib/pillar-parts.ts`
 * `bookedParts`), so the small Budget block no longer sits under the rows — `children` is drawn only where a caller
 * still hands one in (a lab).
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
import { RotateCcw } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import {
  BOOKED_EMPTY,
  WAITING_HEADING,
  WAITING_INFO,
  type BookedView,
} from '@/lib/booked-rows';
import type { PillarPart } from '@/lib/pillar-parts';
import { BookedRowList, WaitingRowItem } from './booked-row';
import { BookedPartRow } from './booked-part-row';
import { GoToFind } from './go-to-find';

/** Hairline rows, no boxes; a row's details fold open in place. */
const BOOKED_CSS =
  '[data-booked-body] .bk-row{border-top:1px solid rgb(var(--color-ink)/.1);padding:12px 0;min-width:0}' +
  '[data-booked-body] .bk-rows>.bk-row:first-child{border-top:0}' +
  '[data-booked-body] .bk-row>button{min-height:44px}' +
  '[data-booked-body] .bk-exp{display:grid;grid-template-rows:0fr;transition:grid-template-rows .28s cubic-bezier(.2,.7,.2,1)}' +
  // min-height:0 is what lets the 0fr track close: `clip` makes no scroll container, so without it a grid item's
  // automatic minimum is its full content height and WebKit (every iPhone) keeps the row OPEN while `inert` makes it
  // untappable — owner 2026-10-30 "All buttons do not work" / "Booked does not collapse".
  '[data-booked-body] .bk-exp>div{overflow:clip;min-width:0;min-height:0}' +
  '[data-booked-body] .bk-row[data-open] .bk-exp{grid-template-rows:1fr}' +
  // The verbs WRAP and keep their words (owner 2026-10-12, look call 2: "buttons
  // keep their words on narrow cards; only Remove may shrink"). With a wrap the
  // row never overflows, so `useFitRow` leaves every word in place.
  '[data-booked-body] .bk-verbs{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}' +
  '[data-booked-body] .bk-slot{display:contents}' +
  // ONE ROW OF EQUAL TILES (owner 2026-10-30, "i was hoping this would be a single row"; the prototype's
  // `.bk-exp .verbs`): equal columns, icon over word, never wrapped — Pay · Chat · Workspace · Report/Cancel.
  '[data-booked-body] .bk-tiles{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;max-width:520px;min-width:0}' +
  '[data-booked-body] .bk-tiles :is(button,a).ab{flex-direction:column;justify-content:center;gap:3px;width:100%;height:auto;min-height:56px;padding:7px 2px;border-radius:var(--m-r-md);font-size:12px;letter-spacing:-.005em;min-width:0;white-space:normal;text-align:center;line-height:1.15}' +
  '[data-booked-body] .bk-tiles :is(button,a).ab svg{width:18px;height:18px}' +
  '[data-booked-body] .bk-tiles .lbl{max-width:100%;overflow:hidden;text-overflow:ellipsis}' +
  // ONE button height: 44 px, the floor (owner 2026-10-12, look call 3 — "44 px
  // minimum, no 40 px rows"). A <button> picks up the app's 44 px touch floor and
  // an <a> does not, so a row of both stood at two heights (measured in the lab
  // at 375: Pay 44, Chat 40) — every one is set to the floor here.
  '[data-booked-body] :is(button,a).ab{height:44px;min-height:44px}' +
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
  parts,
  firstOpen = null,
  children,
}: {
  eventId: string;
  state: BookedBodyState;
  /** Booked's parts (`bookedParts`) — the "Team ▾" dropdown. Absent (a lab without it) → no dropdown. */
  parts?: readonly PillarPart[];
  /** A row open on arrival (a lab's `&open=`) — the rest stay closed. */
  firstOpen?: string | null;
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
        <ActionButton
          href={state.retryHref}
          tone="neutral"
          icon={<RotateCcw aria-hidden strokeWidth={1.9} />}
          label="Try again"
          className="mt-3"
        />
      </div>
    );
  }

  const { waiting, booked, unpriced } = state.view;
  const countLine = [
    `${formatCount(booked.length)} booked`,
    unpriced > 0 ? `${formatCount(unpriced)} without a price` : null,
    waiting.length > 0 ? `${formatCount(waiting.length)} waiting` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div data-booked-body="view">
      <style>{BOOKED_CSS}</style>
      {parts ? <BookedPartRow current="team" line={countLine} /> : null}
      <div className="space-y-7">

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
          <div data-booked-empty="">
            <p className={SUB}>{BOOKED_EMPTY}</p>
            {/* The empty state gives the first action (2026-10-12 look sweep). */}
            <GoToFind className="mt-3" />
          </div>
        ) : (
          <>
            <p className={SUB}>
              {formatCount(booked.length)} booked
              {unpriced > 0 ? (
                <>
                  {' · '}
                  <span className="font-medium text-sn-accent">{formatCount(unpriced)} without a price</span>
                </>
              ) : (
                ' · every price set'
              )}
            </p>
            {dateChangeUnread ? (
              <p className="mt-1 text-[12.5px] text-ink/60" role="status" data-booked-date-unread="">
                We couldn’t check whether a date change is waiting.
              </p>
            ) : null}
            <BookedRowList eventId={eventId} rows={booked} firstOpen={firstOpen} />
          </>
        )}
      </section>

      {children}
      </div>
    </div>
  );
}
