'use client';

import { Check, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { RSVP_ASK_FIELDS, RSVP_ASK_LABEL, rsvpAsks, type RsvpAskConfig, type RsvpAskField } from '@/lib/rsvp-ask';
import { SETUP_ROW_STACK, SETUP_SUB, SETUP_TITLE } from './setup-skin';

/** The row's one sentence (owner 2026-10-07, HOME_AND_GUESTS_CHECK G30) — one spelling for both doors. */
export const RSVP_ASKS_TITLE = 'RSVP asks';
export const RSVP_ASKS_LINE = 'Yes or no is always asked. Tick what else you want from each guest.';

/**
 * ✓ RSVP ASKS — the six questions of `RSVP_ASK_FIELDS` as six toggle BUTTONS,
 * mounted in BOTH doors (Guests › Setup and the Maker's RSVP settings, owner
 * 2026-10-07: *"place what information we want for RSVP"*). On = `✓ Meal`,
 * filled ok; off = `＋ Dietary`, outlined (the prototype's `ib(check|plus)`).
 * Words from `RSVP_ASK_LABEL` (lib/rsvp-ask.ts) — the one spelling.
 *
 * No state and no save of its own: each door hands in `onToggle`, and both
 * save the one `events.rsvp_ask_config` blob. The guest's form asks exactly
 * what is on (`resolveRsvpAsk`). Held by
 * `setup-and-maker-mount-the-same-parts.test.ts` (neither door may draw its own
 * switch for these six).
 */
export function RsvpAsks({
  config,
  onToggle,
  rowClassName = SETUP_ROW_STACK,
}: {
  config: RsvpAskConfig;
  onToggle: (field: RsvpAskField, next: boolean) => void;
  rowClassName?: string;
}) {
  return (
    <section className={rowClassName} data-setup-row="asks" data-made-once="rsvp-ask">
      <div className="min-w-0">
        <p className={SETUP_TITLE}>{RSVP_ASKS_TITLE}</p>
        <p className={SETUP_SUB}>{RSVP_ASKS_LINE}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2" data-rsvp-asks="">
        {RSVP_ASK_FIELDS.map((field) => {
          const on = rsvpAsks(config, field);
          return (
            <ActionButton
              key={field}
              tone={on ? 'ok' : 'brand'}
              main={on}
              icon={on ? Check : Plus}
              label={RSVP_ASK_LABEL[field]}
              aria-pressed={on}
              data-testid={`rsvp-ask-${field}`}
              onClick={() => onToggle(field, !on)}
            />
          );
        })}
      </div>
    </section>
  );
}
