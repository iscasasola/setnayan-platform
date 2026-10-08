'use client';

import type { ReactNode } from 'react';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import {
  GUESTS_GET_IN_LABEL,
  guestsGetInChoice,
  guestsGetInLabel,
  guestsGetInOptions,
  isGuestsGetIn,
  type GuestsGetIn as GetInValue,
} from '@/lib/who-can-reply';
import { SETUP_PICK, SETUP_ROW, SETUP_SUB, SETUP_TITLE } from './setup-skin';

/**
 * 🎟 HOW GUESTS GET IN — the ONE dropdown, mounted in BOTH doors (owner
 * 2026-10-07, HOME_AND_GUESTS_CHECK § "Setup ↔ Event Hub Maker": *"make sure to
 * make the adjustments and mapping on event hub maker as well"*):
 *
 *   · Guests › Setup                 (`invite-panel.tsx` → `GuestSetupRows`)
 *   · the Maker's RSVP settings      (`maker-rsvp-ask.tsx` — Studio › RSVP, the
 *                                     RSVP stage's form and Event Details' RSVP)
 *
 * The five plain names and their one-sentence hints come from
 * `GUESTS_GET_IN_CHOICES` (lib/who-can-reply.ts) — never spelled here. The part
 * holds no state and no save: each door hands in `onPick`, and both save the
 * SAME `events.rsvp_ask_config` keys through `guestsGetInPatch`. One setting,
 * two doors, one copy — held by `setup-and-maker-mount-the-same-parts.test.ts`.
 *
 * 🧾 A DOOR MAY DRAW THE ROW ITSELF (`frame`, 2026-10-08): the Maker's Studio › RSVP and
 * RSVP stage hand in the app's Form row (`ChosenRow` — the same dropdown, in the row's
 * own pill). THIS part still decides the name, the choices, what the closed button
 * says and which pick is a change; the frame only draws them. So this file carries no
 * template, and Guests › Setup keeps its own row.
 */
/** What a door's own frame is handed to draw the dropdown with. */
export type GuestsGetInFrame = {
  name: string;
  /** The stored choice. */
  value: GetInValue;
  /** What the closed button says — heading and choice together. */
  buttonText: string;
  /** The picked choice's one sentence. */
  hint: string;
  options: ReturnType<typeof guestsGetInOptions>;
  /** A pick from the list — a no-op for the choice already stored. */
  onPick: (key: string) => void;
  dataAttr: string;
  /** The part's own marks, for the row the frame draws (never a wrapper: a row must stay a direct child of its list). */
  attrs: Readonly<Record<`data-${string}`, string>>;
};

export function GuestsGetIn({
  value,
  onPick,
  rowClassName = SETUP_ROW,
  pickClassName = SETUP_PICK,
  frame,
}: {
  /** The door's own row (the Maker's Form row) — see the docblock. */
  frame?: (row: GuestsGetInFrame) => ReactNode;
  value: GetInValue;
  onPick: (next: GetInValue) => void;
  /** The door's row shape — Setup's by default; the Studio hands in `STUDIO_ROW`. */
  rowClassName?: string;
  pickClassName?: string;
}) {
  const choice = guestsGetInChoice(value);
  const pick = (next: string) => (next === value || !isGuestsGetIn(next) ? undefined : onPick(next));
  if (frame) {
    return (
      <>
        {frame({
          name: GUESTS_GET_IN_LABEL,
          value,
          buttonText: guestsGetInLabel(value),
          hint: choice.hint,
          options: guestsGetInOptions(),
          onPick: pick,
          dataAttr: 'data-rsvp-who-pick',
          attrs: { 'data-setup-row': 'get-in', 'data-rsvp-setting': 'who-can-rsvp', 'data-get-in': value },
        })}
      </>
    );
  }
  return (
    <section className={rowClassName} data-setup-row="get-in" data-rsvp-setting="who-can-rsvp" data-get-in={value}>
      <div className="min-w-0">
        <p className={SETUP_TITLE}>{GUESTS_GET_IN_LABEL}</p>
        <p className={SETUP_SUB}>{choice.hint}</p>
      </div>
      <PickMenu
        label={GUESTS_GET_IN_LABEL}
        dataAttr="data-rsvp-who-pick"
        value={value}
        buttonText={guestsGetInLabel(value)}
        options={guestsGetInOptions()}
        onPick={pick}
        className={pickClassName}
      />
    </section>
  );
}
