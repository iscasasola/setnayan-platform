'use client';

import type { ReactNode } from 'react';
import { Chips } from '@/app/_components/chips';
import { RSVP_ASK_FIELDS, RSVP_ASK_LABEL, rsvpAsks, type RsvpAskConfig, type RsvpAskField } from '@/lib/rsvp-ask';
import { SETUP_ROW_STACK, SETUP_SUB, SETUP_TITLE } from './setup-skin';

/** The row's one sentence (owner 2026-10-07, HOME_AND_GUESTS_CHECK G30) — one spelling for both doors. */
export const RSVP_ASKS_TITLE = 'RSVP asks';
export const RSVP_ASKS_LINE = 'Yes or no is always asked. Tick what else you want from each guest.';

/**
 * ✓ RSVP ASKS — the six questions of `RSVP_ASK_FIELDS` as six CHIPS, mounted in
 * BOTH doors (Guests › Setup and the Maker's RSVP settings, owner 2026-10-07:
 * *"place what information we want for RSVP"*). The app's one "choose several
 * from a few" (`app/_components/chips.tsx`, `INTERACTION_RULES.md` § 9 kind 11,
 * the approved gallery § 11 — owner 2026-10-08: *"we want the whole app to be
 * adaptive to the same feel"*): on = the accent, off = grey on white, the same
 * size either way. (They were six `ActionButton` toggles — `✓ Meal` filled
 * green, `＋ Dietary` outlined — until then.) Words from `RSVP_ASK_LABEL`
 * (lib/rsvp-ask.ts) — the one spelling.
 *
 * 🧾 A DOOR MAY DRAW THE ROW AROUND THEM (`frame`): the Maker hands in the app's
 * Form row (the name, the sentence behind its ⓘ, the chips under it). The chips
 * themselves are drawn HERE in both doors — one look.
 *
 * No state and no save of its own: each door hands in `onToggle`, and both
 * save the one `events.rsvp_ask_config` blob. The guest's form asks exactly
 * what is on (`resolveRsvpAsk`). Held by
 * `setup-and-maker-mount-the-same-parts.test.ts` (neither door may draw its own
 * switch for these six).
 */
/**
 * What a door's own row is handed (`frame`): the chips, drawn here — or, for a door with ONE row for all six (the
 * Maker's toolbar: a dropdown with a tick each), the six themselves, which are on, and the one writer. Either way the
 * six, their words and what is on are this part's — a door never lists them itself.
 */
export type RsvpAsksFrame = {
  name: string;
  line: string;
  chips: ReactNode;
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
  /** The door's own row around the chips (the Maker's Form row). */
  frame?: (row: RsvpAsksFrame) => ReactNode;
  config: RsvpAskConfig;
  onToggle: (field: RsvpAskField, next: boolean) => void;
  rowClassName?: string;
}) {
  const chips = (
    <div data-rsvp-asks="">
      <Chips<RsvpAskField>
        label={RSVP_ASKS_TITLE}
        data="rsvp-asks"
        options={RSVP_ASK_FIELDS.map((field) => ({ key: field, label: RSVP_ASK_LABEL[field], testId: `rsvp-ask-${field}` }))}
        value={RSVP_ASK_FIELDS.filter((field) => rsvpAsks(config, field))}
        onToggle={onToggle}
      />
    </div>
  );
  if (frame) {
    /* Never a wrapper of this part's own: a row must stay a direct child of its list. */
    return (
      <>
        {frame({
          name: RSVP_ASKS_TITLE,
          line: RSVP_ASKS_LINE,
          chips,
          attrs: { 'data-setup-row': 'asks', 'data-made-once': 'rsvp-ask' },
          asks: RSVP_ASK_FIELDS.map((field) => ({ key: field, label: RSVP_ASK_LABEL[field] })),
          on: RSVP_ASK_FIELDS.filter((field) => rsvpAsks(config, field)),
          onToggle,
        })}
      </>
    );
  }
  return (
    <section className={rowClassName} data-setup-row="asks" data-made-once="rsvp-ask">
      <div className="min-w-0">
        <p className={SETUP_TITLE}>{RSVP_ASKS_TITLE}</p>
        <p className={SETUP_SUB}>{RSVP_ASKS_LINE}</p>
      </div>
      {chips}
    </section>
  );
}
