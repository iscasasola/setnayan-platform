/**
 * asked-once.ts — a birthday asks the celebrant's name ONCE (owner 2026-10-22, "Yes to all": Host 6, prototype
 * `journey_fixes_2026-10-22.html`; the 1 Oct ruling "ask every fact once").
 *
 * The generic onboarding asks "Who are we celebrating?" on its honoree screen, then the specialty screen's catalog
 * field "Celebrant" (`specialty-catalog.ts`, `celebrant_name`) asked it AGAIN — pre-filled, but still a box with a
 * cursor in it, which is a question whatever the label says. Now the specialty screen SHOWS the answer —
 * "Celebrant · Lola Rosa  Change" — the "answer kept visible with Change" the create picker already uses, and Change
 * goes back to the one place the name is asked.
 *
 * And the birthday's Event name example was the hangout's ("Movie night sa bahay"): one example per type, from the
 * name already given.
 *
 * Pure + I/O-free: the client wizard imports it and its guard executes it.
 */

/** Specialty keys whose answer IS the honoree screen's answer — shown there, never asked twice. */
export const ASKED_ON_THE_HONOREE_SCREEN = ['celebrant_name'] as const;

/**
 * Which specialty fields to SHOW rather than ask: those whose value is exactly the one this flow already holds from
 * the honoree screen (or the account holder's own name for their own birthday). A value the person typed differently
 * (an older draft) keeps its field — hiding somebody's own answer behind a chip would be a wall. And only when the
 * honoree screen exists to go back to; otherwise there is nowhere for Change to lead.
 */
export function specialtyAskedElsewhere(input: {
  values: Record<string, unknown>;
  derived: Record<string, unknown>;
  hasHonoreeScreen: boolean;
}): string[] {
  if (!input.hasHonoreeScreen) return [];
  return ASKED_ON_THE_HONOREE_SCREEN.filter((k) => {
    const v = input.values[k];
    return typeof v === 'string' && v.trim() !== '' && v === input.derived[k];
  });
}

/** The drawn example when nothing is known yet. */
export const BIRTHDAY_NAME_EXAMPLE = 'Lola Rosa turns 80';

/**
 * The Event name box's example for this type, from what the flow already knows. Null = this type keeps the line its
 * screen already shows (only the birthday borrowed another type's example).
 */
export function eventNameExample(input: { eventType: string; name?: string | null; age?: number | null }): string | null {
  if (input.eventType !== 'birthday') return null;
  const name = (input.name ?? '').trim();
  if (!name) return BIRTHDAY_NAME_EXAMPLE;
  return input.age != null && input.age > 0 ? `${name} turns ${input.age}` : `${name}’s birthday`;
}
