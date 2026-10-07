'use client';

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
 */
export function GuestsGetIn({
  value,
  onPick,
  rowClassName = SETUP_ROW,
  pickClassName = SETUP_PICK,
}: {
  value: GetInValue;
  onPick: (next: GetInValue) => void;
  /** The door's row shape — Setup's by default; the Studio hands in `STUDIO_ROW`. */
  rowClassName?: string;
  pickClassName?: string;
}) {
  const choice = guestsGetInChoice(value);
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
        onPick={(next) => (next === value || !isGuestsGetIn(next) ? undefined : onPick(next))}
        className={pickClassName}
      />
    </section>
  );
}
