import { readOneAtATime } from '@/lib/rsvp-ask';

/**
 * "Ask one question at a time" — the RSVP scene's ONE switch (owner 2026-09-27,
 * DECISION_LOG "THE RSVP IS ONE EDITABLE SCENE + ONE SWITCH").
 *
 * 🔑 ONE STORED VALUE, OWNED BY THE MAKER: `oneAtATime` inside
 * `events.rsvp_ask_config`, read by the couple side's own reader
 * (`readOneAtATime`, lib/rsvp-ask.ts). This name is kept so the guest pages ask
 * the SAME function the Maker writes against — absent or malformed is OFF.
 */
export function askOneAtATime(raw: unknown): boolean {
  return readOneAtATime(raw);
}
