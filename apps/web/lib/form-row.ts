/**
 * lib/form-row.ts — THE FORM ROW'S RULES, with no component in them (`app/_components/form-row.tsx` draws them).
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9; approved gallery `prototypes/control_templates_2026-10-08.html`
 * § 6 Form row · § 10 Field): *"cannot edit the other. no more check just (X) tapping out is auto accept or
 * pressing enter"* · *"highlighted text box are required"* · *"if a text box has incomplete information or invalid.
 * make it shake so they can find it easily"* · *"i want this to scroll so they see the whole content of the
 * message. pause for 1 second then start from the beginning again"*.
 *
 * Pure: no React, no DOM, no I/O — so each rule is EXECUTED by `lib/the-form-row.test.ts`, not described by it.
 */
import { formatCount } from './format-number';

/* ── THE ROW'S LOOK, as classes (2026-10-21) ──────────────────────────────
 * Here, not in the component, so a screen that draws its own row (the Suppliers page's category rows,
 * `shortlist-categories.tsx`) can wear the template's line and second line without importing the component
 * and everything it draws with. `form-row.tsx` builds its own rows from these same two strings. */

/** The thin line between rows — one row's top edge. (`FORM_ROW_BAND` drops it from a list's first row; a list split
 *  across several boxes wears this on every row, so no box's first row loses its line.) */
export const FORM_ROW_RULE = 'border-t border-ink/10';
/** A row's quiet second line under its name — the words' look only; the screen places it. */
export const FORM_ROW_SUBLINE = 'text-[12.5px] font-normal leading-snug text-ink/55';

/* ── A LONG ANSWER IN ITS PILL ────────────────────────────────────────── */

/** It rests this long at its start, and again at its end (owner: "pause for 1 second"). */
export const LONG_ANSWER_REST_MS = 1000;
/** A reading pace: this many ms for each px the words run past the pill — never quicker than `LONG_ANSWER_MIN_MOVE_MS`. */
export const LONG_ANSWER_MS_PER_PX = 28;
export const LONG_ANSWER_MIN_MOVE_MS = 1200;
/** The way back to the beginning. */
export const LONG_ANSWER_BACK_MS = 350;
/** Words that run past the pill by no more than this are simply shown — nothing moves for two pixels. */
export const LONG_ANSWER_SLACK_PX = 2;

export type LongAnswerPlan = {
  /** One whole turn: rest · travel · rest · return. It repeats for as long as the pill is on screen. */
  totalMs: number;
  /** The strip's `translateX` (px) at each point of the turn — `offset` is its share of `totalMs`. */
  frames: Array<{ x: number; offset: number }>;
};

/**
 * How a pill's words travel when they are `overflowPx` wider than the pill: rest one second at the start, scroll to
 * the end at a reading pace, rest one second, return, and again. Null = they fit: nothing moves.
 * Moved with `transform` on the words' own strip — an animated `text-indent` was measured changing in the owner's
 * browser without being repainted (`INTERACTION_RULES.md` § 9, "Long answers — build note").
 */
export function longAnswerPlan(overflowPx: number): LongAnswerPlan | null {
  if (!(overflowPx > LONG_ANSWER_SLACK_PX)) return null;
  const d = Math.round(overflowPx);
  const move = Math.max(LONG_ANSWER_MIN_MOVE_MS, d * LONG_ANSWER_MS_PER_PX);
  const totalMs = LONG_ANSWER_REST_MS + move + LONG_ANSWER_REST_MS + LONG_ANSWER_BACK_MS;
  return {
    totalMs,
    frames: [
      { x: 0, offset: 0 },
      { x: 0, offset: LONG_ANSWER_REST_MS / totalMs },
      { x: -d, offset: (LONG_ANSWER_REST_MS + move) / totalMs },
      { x: -d, offset: (LONG_ANSWER_REST_MS + move + LONG_ANSWER_REST_MS) / totalMs },
      { x: 0, offset: 1 },
    ],
  };
}

/** May the words travel now? Only on screen, never while that row is being edited, never under "reduce motion". */
export function longAnswerMoves(at: { onScreen: boolean; editing: boolean; reducedMotion: boolean }): boolean {
  return at.onScreen && !at.editing && !at.reducedMotion;
}

/* ── LEAVING AN OPEN FIELD ────────────────────────────────────────────── */

/**
 * How an open field was left. Tapping anywhere outside it, Enter, or Tab / Shift+Tab KEEPS; ✕ or Esc leaves it as it was.
 * ⇥ `tab` / `tab-back` (owner 2026-10-21: *"pressing tab on keyboard should allow next row on the guest card?"*) keep exactly
 * as Enter does — the same `keepOutcome`, the same one keep — and then move on to the next row (or the one before).
 */
export type FieldExit = 'tap-out' | 'enter' | 'x' | 'escape' | 'tab' | 'tab-back';

/** There is no ✓: the only ways to keep are tapping out, Enter and Tab. */
export function exitKeeps(exit: FieldExit): boolean {
  return exit === 'tap-out' || exit === 'enter' || exit === 'tab' || exit === 'tab-back';
}

/** Which way a keyboard exit moves on once it has kept: 1 = the next row, -1 = the one before, 0 = it stays on its row. */
export function exitMoves(exit: FieldExit): 1 | -1 | 0 {
  return exit === 'tab' ? 1 : exit === 'tab-back' ? -1 : 0;
}

/**
 * ⇥ THE ROW TAB GOES TO — the next (`dir` 1) or previous (-1) row after `from`, in the order the rows are drawn, that can be
 * reached (not inside a shut fold — `inert` — and drawn at all) and has something to press. Null = there is none: the keep
 * still happens and the focus stays on its own row. Pure, so `lib/the-form-row.test.ts` executes it; `form-row.tsx` hands it
 * the screen's rows.
 */
export function rowToTabTo(rows: readonly { reachable: boolean; control: boolean }[], from: number, dir: 1 | -1): number | null {
  for (let i = from + dir; i >= 0 && i < rows.length; i += dir) if (rows[i]!.reachable && rows[i]!.control) return i;
  return null;
}

/** In a long message Enter is a new line — so it is the tap out that keeps it. */
export function enterKeeps(long: boolean): boolean {
  return !long;
}

export type KeepOutcome =
  /** ✕ / Esc, or nothing was changed: the row closes and nothing is sent. */
  | { kind: 'as-it-was' }
  /** A box that must be filled was left empty: the answer stays as it was, and the row shakes. */
  | { kind: 'still-needed' }
  /** Something is WRONG with what was typed: it stays in the pill (red), is said under the row, and is NOT sent. */
  | { kind: 'wrong'; text: string; words: string }
  /** Keep it: show it at once, and send it — once. */
  | { kind: 'send'; text: string };

/**
 * What leaving an open field means. `typed` is what is in the box, `before` what the pill showed.
 * A long message keeps its own line breaks; a one-line answer is one line (runs of white space become one space).
 */
export function keepOutcome(input: {
  exit: FieldExit;
  typed: string;
  before: string;
  long?: boolean;
  required?: boolean;
  /** Says what is wrong in plain words, or null when it is fine. */
  check?: ((text: string) => string | null) | null;
}): KeepOutcome {
  if (!exitKeeps(input.exit)) return { kind: 'as-it-was' };
  const text = input.long ? input.typed.trim() : input.typed.replace(/\s+/g, ' ').trim();
  if (text === '' && input.required) return { kind: 'still-needed' };
  const words = text === '' ? null : (input.check?.(text) ?? null);
  if (words) return { kind: 'wrong', text, words };
  if (text === input.before) return { kind: 'as-it-was' };
  return { kind: 'send', text };
}

/* ── REQUIRED ─────────────────────────────────────────────────────────── */

/** A box that must be filled wears the highlight and the word "Required" until it is filled — then neither. */
export function showsRequired(required: boolean | undefined, answer: string): boolean {
  return Boolean(required) && answer.trim() === '';
}

/* ── AN AMOUNT KEEPS ITS ₱ ────────────────────────────────────────────── */

/** Only the digits of what was typed ("₱250,000.00 po" → "250000"). */
export function amountDigits(typed: string): string {
  return (typed.split('.')[0] ?? '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
}

/** An amount as the pill shows it: its mark, then the number with its commas ("₱250,000"). '' stays ''. */
export function amountWords(digits: string, mark = '₱'): string {
  const d = amountDigits(digits);
  return d === '' ? '' : `${mark}${formatCount(Number(d), 0)}`;
}

/* ── A SAVE THAT DID NOT LAND ─────────────────────────────────────────── */

/** What a row's keep may answer: nothing (it took it), or whether it landed — and, if not, why, in plain words. */
export type KeepAnswer = void | { ok: true } | { ok: false; error?: string | null };

/** The one line a row says when its save did not land — never silent, never the look of success. */
export function saveFailedWords(name: string, reason?: string | null): string {
  const why = (reason ?? '').trim();
  return `${name} did not save.${why ? ` ${why}` : ''}`;
}
