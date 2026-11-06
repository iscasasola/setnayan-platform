/**
 * apps/web/lib/rsvp-celebration.ts
 *
 * 🎉 "WHEN YES" GETS A CELEBRATION (owner 2026-10-06, DECISION_LOG row
 * '"WHEN YES" GETS A CELEBRATION (PRO)'; prototype
 * `prototypes/when_yes_celebration_2026-10-06_fable.html`). The RSVP stage's
 * When yes screen offers ONE dropdown — Celebration ▾ — and the guest who just
 * said yes sees the pick play ONCE (~2–3 s) as the thank-you appears.
 *
 *   · None       — free, and the DEFAULT (an absent key reads as None, so every
 *                  event that never opened the dropdown is byte-for-byte as it was);
 *   · Confetti · Fireworks · Petals · Sparklers — ◆ Event Hub Pro: tried in the
 *                  Maker's draft, named at Apply, written only with Pro
 *                  (`eventItemIsPro` / `planHubDraftApply`, lib/hub-draft.ts).
 *
 * ── WHERE IT IS STORED ──────────────────────────────────────────────────────
 * `events.rsvp_ask_config.celebration` — the SAME jsonb the When yes words live
 * in (`words.thanksHeading` / `words.thanksMessage`), drafted through the same
 * one object (`maker-rsvp-ask.tsx`) and read through the same sanitizer
 * (`sanitizeRsvpAskConfig`). No migration: the column's CHECK is "an object
 * under 2 KB", which one short key keeps.
 *
 * 🗣 "When they say yes" is the MAKER's label (owner 2026-10-07: *"Yes rename it to When they say yes"*; it was "Celebration").
 * Nothing a guest reads says it.
 *
 * Pure, and imports nothing — the Maker's panel, the guest page and the draft
 * classifier all read it without pulling anything else in.
 */

export const RSVP_CELEBRATIONS = ['none', 'confetti', 'fireworks', 'petals', 'sparklers'] as const;
export type RsvpCelebration = (typeof RSVP_CELEBRATIONS)[number];

/** A new event's pick, and what an absent / unknown key reads as. */
export const RSVP_CELEBRATION_DEFAULT: RsvpCelebration = 'none';

/** The Maker's word for the control. */
export const RSVP_CELEBRATION_LABEL = 'When they say yes';

/** Each pick's name in the Maker's dropdown — in the prototype's order (None last). */
export const RSVP_CELEBRATION_NAME: Readonly<Record<RsvpCelebration, string>> = {
  confetti: 'Confetti',
  fireworks: 'Fireworks',
  petals: 'Petals',
  sparklers: 'Sparklers',
  none: 'None',
};

/** The dropdown's order: the four effects, then None (the prototype's list). */
export const RSVP_CELEBRATION_ORDER: readonly RsvpCelebration[] = ['confetti', 'fireworks', 'petals', 'sparklers', 'none'];

export function isRsvpCelebration(v: unknown): v is RsvpCelebration {
  return typeof v === 'string' && (RSVP_CELEBRATIONS as readonly string[]).includes(v);
}

/** Every effect is Event Hub Pro; None never is. */
export function celebrationIsPro(kind: RsvpCelebration): boolean {
  return kind !== 'none';
}

/** The stored key, read: a known pick, else None. */
export function readCelebrationKey(raw: unknown): RsvpCelebration {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return RSVP_CELEBRATION_DEFAULT;
  const v = (raw as Record<string, unknown>).celebration;
  return isRsvpCelebration(v) ? v : RSVP_CELEBRATION_DEFAULT;
}

/**
 * Does moving the stored config from `live` to `next` ADD or CHANGE an effect
 * (the Pro question)? Going back to None — or keeping the effect that is
 * already live — never is.
 */
export function celebrationDraftIsPro(live: unknown, next: unknown): boolean {
  const to = readCelebrationKey(next);
  return celebrationIsPro(to) && to !== readCelebrationKey(live);
}

/**
 * The house colours an effect falls back to when the Mood Board holds fewer
 * than two — the house button (#C24E25), its gild, the brand mulberry and a
 * blush, so a bare event still plays in Setnayan's own warmth.
 */
export const CELEBRATION_HOUSE_COLOURS: readonly string[] = ['#c24e25', '#b8893f', '#5c2542', '#f2c8c2', '#6b7a3a'];

/**
 * The effect's colours: the Mood Board's own swatches (up to five), topped up
 * from the house set when there are fewer than two. Always five or fewer
 * `#rrggbb`, never empty.
 */
export function celebrationColours(swatches: readonly string[]): string[] {
  const hex = swatches.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toLowerCase());
  const own = [...new Set(hex)].slice(0, 5);
  if (own.length >= 2) return own;
  return [...new Set([...own, ...CELEBRATION_HOUSE_COLOURS])].slice(0, 5);
}

/* ── The Maker ⇄ frame bridge (no imports, so the guest page can read it) ── */

/** The Maker's window event: play the pick on the When yes frame — `detail` is `{ kind }`. */
export const RSVP_CELEBRATE_EVENT = 'setnayan:rsvp-celebrate';
/** The bridge message's `t` — `{ source, t: 'celebrate', kind }`. */
export const RSVP_CELEBRATE_MESSAGE = 'celebrate';

/** The query flag the guest's reply returns with (`submitRsvp` → `?rsvp=ok`). */
export const JUST_REPLIED_PARAM = 'rsvp';
export const JUST_REPLIED_VALUE = 'ok';

/**
 * The address to put back once the effect has started: the thank-you's own,
 * without `?rsvp=ok` — so a reload never plays it again. Null when the address
 * carries no just-replied flag (nothing to forget). Only `ok` is taken: the
 * other outcomes (`details`, `refused`) are notices the page still reads.
 */
export function withoutJustReplied(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.searchParams.get(JUST_REPLIED_PARAM) !== JUST_REPLIED_VALUE) return null;
  url.searchParams.delete(JUST_REPLIED_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Does the guest page mount the effect's canvas at all? Only for a guest who
 * just said yes to a pick — or on the Maker's sample, which waits to be told.
 * None, and a reload with no fresh yes, mount nothing (and fetch no engine).
 */
export function celebrationCanvasShown(input: { kind: RsvpCelebration; play: boolean; listen: boolean }): boolean {
  return input.listen || (input.play && input.kind !== 'none');
}
