/**
 * "Ask one question at a time" — the RSVP scene's ONE switch (owner 2026-09-27,
 * DECISION_LOG "THE RSVP IS ONE EDITABLE SCENE + ONE SWITCH").
 *
 * 🔑 ONE STORED VALUE, OWNED BY THE MAKER. The couple sets it on the Maker's
 * RSVP page, stored as `oneAtATime` inside the same `events.rsvp_ask_config`
 * jsonb the "What do you ask your guests?" switches live in (`lib/rsvp-ask.ts`,
 * the couple side's module). The guest side only READS it — and reads the raw
 * key defensively, because `sanitizeRsvpAskConfig` keeps only the six question
 * keys: an absent, non-boolean or unknown value is OFF, so every event that
 * never touched the switch keeps its one scrolling page.
 *
 * Pure — no I/O.
 */
export const RSVP_ONE_AT_A_TIME_KEY = 'oneAtATime';

export function askOneAtATime(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  return (raw as Record<string, unknown>)[RSVP_ONE_AT_A_TIME_KEY] === true;
}
