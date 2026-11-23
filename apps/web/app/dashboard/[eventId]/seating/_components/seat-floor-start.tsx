'use client';

import { useRef, type ReactNode } from 'react';
import { DoorOpen, Plus, Sparkles, Square } from 'lucide-react';
import { useThumbRoom } from '@/lib/thumb-room';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';

/**
 * 🪑 THE EMPTY FLOOR'S FIRST STEP (owner 2026-11-20, "Yes, your picks" — DECISION_LOG "GUESTS › SEATS, ROUND TWO",
 * pick 2; drawing `prototypes/guests_redesign_2026-11-20/…_fable.html` § 9 frames A · B · 1).
 *
 *   · "Seat everyone for me" is THE main button; "Add a table" is second.
 *   · When the booked venue drew its hall, "Start from this hall" comes first (and "Start empty" beside it); once the
 *     hall is in, the two buttons above are what is left.
 *   · NOTHING DEPENDS ON PRESSING THE FLOOR: the buttons are a card in the lower third, never a card drawn on the plan.
 *     (The plan captures every press for its pan — a button on it once swallowed every tap, live, 20 Nov.)
 *
 * It replaces "Lay out your floor"'s three steps. "Set room size" moved to ⋯ › Room size and is named in the ⓘ;
 * "Build my seating draft" is "Seat everyone for me" — the same action, a plainer name.
 *
 * Presentational: it saves nothing. 🔒 the-empty-floor-starts-in-one-tap.test.ts
 */
export type FloorHall = {
  /** The venue's shop name — "Hotel Luna". */
  shop: string;
  /** The hall's own name — "Grand Ballroom" — worn in the floor's top-left corner. */
  name?: string | null;
  /** How many tables the venue placed in that hall. */
  tables: number;
};

export function FloorStartButtons({
  toSeat,
  hall = null,
  canEdit,
  busy = false,
  seatEveryoneNote,
  onSeatEveryone,
  onAddTable,
  onStartFromHall,
  onStartEmpty,
}: {
  /** People who are coming and have no seat. */
  toSeat: number;
  /** The booked venue's hall, when it drew one and it is not on this floor yet. */
  hall?: FloorHall | null;
  canEdit: boolean;
  busy?: boolean;
  /** Why "Seat everyone for me" cannot run, when it cannot ("Add your guests first"). */
  seatEveryoneNote?: string | null;
  onSeatEveryone: () => void;
  onAddTable: () => void;
  onStartFromHall?: () => void;
  onStartEmpty?: () => void;
}) {
  const off = !canEdit ? 'Tap Edit first' : null;
  // The venue's hall comes first — only when there is a way to bring it in (never a button that does nothing).
  if (hall && onStartFromHall) {
    return (
      <div data-floor-start="hall" className="flex min-w-0 flex-col gap-2">
        <p className="text-[13px] text-ink/70">
          Stage, doors and {formatCount(hall.tables)} {hall.tables === 1 ? 'table is' : 'tables are'} already placed.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton tone="brand" main icon={DoorOpen} label="Start from this hall" onClick={onStartFromHall} disabled={!canEdit || busy} title={off ?? undefined} data-floor-start-hall="" className="w-full" />
          <ActionButton tone="neutral" icon={Square} label="Start empty" onClick={onStartEmpty} disabled={!canEdit || busy} title={off ?? undefined} data-floor-start-empty="" className="w-full" />
        </div>
      </div>
    );
  }
  const seatOff = off ?? seatEveryoneNote ?? null;
  return (
    <div data-floor-start="steps" className="flex min-w-0 flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          tone="brand"
          main
          waiting={busy}
          icon={Sparkles}
          label="Seat everyone for me"
          onClick={onSeatEveryone}
          disabled={Boolean(seatOff) && !busy}
          title={seatOff ?? undefined}
          data-floor-seat-everyone=""
          className="w-full"
        />
        <ActionButton tone="neutral" icon={Plus} label="Add a table" onClick={onAddTable} disabled={!canEdit || busy} title={off ?? undefined} data-floor-add-table="" className="w-full" />
      </div>
      {seatOff && toSeat === 0 ? (
        <p className="text-xs text-ink/70" data-floor-start-note="">
          {seatOff}
        </p>
      ) : null}
    </div>
  );
}

/** The card's heading — "8 guests to seat ⓘ", or the venue's line when it drew the hall. */
export function FloorStartTitle({ toSeat, hall = null }: { toSeat: number; hall?: FloorHall | null }) {
  return (
    <InfoTip
      label={hall ? `${hall.shop} drew this hall` : toSeat > 0 ? `${formatCount(toSeat)} ${toSeat === 1 ? 'guest' : 'guests'} to seat` : 'Your floor is empty'}
      labelClassName="text-[13.5px] font-semibold text-ink"
      align="start"
    >
      {hall
        ? 'The floor is the same drawing your venue made on its Spaces: the hall’s size, stage, doors and its usual tables. Their own drawing never changes — yours is a copy you can move, add to and remove from.'
        : '“Seat everyone for me” makes the tables, lines them up in rows facing the stage and seats everyone who is coming. Nothing is locked in: drag a table, or tap a guest. Room size is in ⋯ › Room size.'}
    </InfoTip>
  );
}

/** The whole card, for a screen with no "To seat" tray to carry the buttons (a computer, or nobody left to seat). */
export function FloorStartCard(props: Parameters<typeof FloorStartButtons>[0]) {
  return (
    <div data-floor-start-card="" className="sn-frame flex min-w-0 flex-col gap-2 px-3.5 py-3">
      <FloorStartTitle toSeat={props.toSeat} hall={props.hall} />
      <FloorStartButtons {...props} />
    </div>
  );
}

/**
 * ⬇ ANYTHING DRAWN OVER THE THUMB ROW LEAVES ROOM FOR ITSELF — the "To seat" tray's own rule
 * (`seat-face-tray.tsx`, `useThumbRoom`): the zoom stack and Fit both stand on `--sn-thumb-room`, so a card that did
 * not publish its height would sit ON the zoom and under the fitted room. The empty floor's card and the Add box are
 * drawn through this.
 */
export function OverThumbRow({ children, mark }: { children: ReactNode; mark: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useThumbRoom(ref);
  return (
    <div ref={ref} data-over-thumb-row={mark}>
      {children}
    </div>
  );
}
