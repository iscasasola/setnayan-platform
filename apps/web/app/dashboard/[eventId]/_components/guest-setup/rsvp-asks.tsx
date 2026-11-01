'use client';

import type { ReactNode } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { RSVP_ASK_FIELDS, RSVP_ASK_LABEL, rsvpAsks, rsvpAsksFace, rsvpAsksPick, type RsvpAskConfig, type RsvpAskField } from '@/lib/rsvp-ask';
import { SETUP_ROW_STACK, SETUP_SUB, SETUP_TITLE } from './setup-skin';

/** The row's one sentence (owner 2026-10-07, HOME_AND_GUESTS_CHECK G30) — one spelling for both doors. */
export const RSVP_ASKS_TITLE = 'RSVP asks';
export const RSVP_ASKS_LINE = 'Yes or no is always asked. Tick what else you want from each guest.';

/**
 * ☑ RSVP ASKS — the six questions of `RSVP_ASK_FIELDS` as ONE DROPDOWN WITH TICKS, mounted in BOTH doors (Guests ›
 * Setup and the Maker's RSVP settings, owner 2026-10-07: *"place what information we want for RSVP"*).
 *
 * Owner, 2026-11-01 (DECISION_LOG "GUESTS › RSVP ASKS IS A DROPDOWN WITH TICKS, NOT CHIPS"), picking *"Dropdown with
 * ticks"*: the asks were six chips (the 2026-10-08 gallery's "choose several from a few"); they are now the one shared
 * `PickMenu` with `picked` — a tick keeps it open, Done closes it — exactly as the Maker card toolbar already drew them
 * (`rsvpAsksDd`). Its face ("4 of 6 on" · "None") and its pick are written once (`rsvpAsksFace` · `rsvpAsksPick`,
 * lib/rsvp-ask.ts). Words from `RSVP_ASK_LABEL` — the one spelling.
 *
 * 🧾 A DOOR MAY DRAW THE ROW AROUND IT (`frame`): Guests › Setup and the Maker's list hand in the app's Form row
 * (`ChosenRow` with `picked`), the Maker card toolbar its own `Dd`. Unframed, the part draws its own row: the name, the
 * sentence and the same dropdown.
 *
 * No state and no save of its own: each door hands in `onToggle`, and both save the one `events.rsvp_ask_config` blob.
 * The guest's form asks exactly what is on (`resolveRsvpAsk`). Held by `setup-and-maker-mount-the-same-parts.test.ts`
 * (neither door may draw its own control for these six).
 */
/**
 * What a door's own row is handed (`frame`): the six, which are on, and the one writer — the door draws the dropdown
 * (with `rsvpAsksFace` / `rsvpAsksPick`). The six, their words and what is on are this part's — a door never lists them.
 */
export type RsvpAsksFrame = {
  name: string;
  line: string;
  attrs: Readonly<Record<`data-${string}`, string>>;
  asks: ReadonlyArray<{ key: RsvpAskField; label: string }>;
  on: readonly RsvpAskField[];
  onToggle: (field: RsvpAskField, next: boolean) => void;
};

export function RsvpAsks({
  config,
  onToggle,
  rowClassName = SETUP_ROW_STACK,
  frame,
}: {
  /** The door's own row around the dropdown (the app's Form row, or the Maker card toolbar's `Dd`). */
  frame?: (row: RsvpAsksFrame) => ReactNode;
  config: RsvpAskConfig;
  onToggle: (field: RsvpAskField, next: boolean) => void;
  rowClassName?: string;
}) {
  const asks = RSVP_ASK_FIELDS.map((field) => ({ key: field, label: RSVP_ASK_LABEL[field] }));
  const on = RSVP_ASK_FIELDS.filter((field) => rsvpAsks(config, field));
  /* `data-rsvp-asks-on` — the asks that are on, on the row itself: a shut dropdown shows only "4 of 6 on", so this is
     where a check (and a person inspecting the page) reads WHICH ones (`one-setting-two-doors.test.ts`). */
  if (frame) {
    /* Never a wrapper of this part's own: a row must stay a direct child of its list. */
    return (
      <>
        {frame({
          name: RSVP_ASKS_TITLE,
          line: RSVP_ASKS_LINE,
          attrs: { 'data-setup-row': 'asks', 'data-made-once': 'rsvp-ask', 'data-rsvp-asks-on': on.join(' ') },
          asks,
          on,
          onToggle,
        })}
      </>
    );
  }
  return (
    <section className={rowClassName} data-setup-row="asks" data-made-once="rsvp-ask" data-rsvp-asks-on={on.join(' ')}>
      <div className="min-w-0">
        <p className={SETUP_TITLE}>{RSVP_ASKS_TITLE}</p>
        <p className={SETUP_SUB}>{RSVP_ASKS_LINE}</p>
      </div>
      <PickMenu
        label={RSVP_ASKS_TITLE}
        value={null}
        picked={on}
        options={asks}
        buttonText={rsvpAsksFace(on.length, asks.length)}
        onPick={rsvpAsksPick({ asks, on, onToggle })}
        dataAttr="data-rsvp-asks"
      />
    </section>
  );
}
