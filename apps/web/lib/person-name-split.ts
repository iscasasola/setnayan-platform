/**
 * person-name-split.ts — one written name becomes a first and a last, for the
 * one place in the product that has a WHOLE name and needs two.
 *
 * The guest list stores `first_name` + `last_name`, and `last_name` is NOT
 * NULL. Every other list stores one string: the People roster returns `name`,
 * a samahan co-member arrives as `display_name`. So the "add from your people"
 * picker has to split, and this is the only place it happens.
 *
 * ── THE RULE THAT MATTERS IS THE ONE ABOUT NOT KNOWING ────────────────────
 * A single word returns `last: ''`. It does NOT invent a placeholder, repeat
 * the first word, or write a dash. The picker asks the host for the missing
 * half instead — one small box, on that row only.
 *
 * Inventing a last name here would be silent and permanent: it goes onto an
 * invitation, a place card and a check-in list, and nobody would ever see the
 * moment it was made up. An empty string is a question the screen can ask.
 *
 * ── SUFFIXES RIDE WITH THE SURNAME ────────────────────────────────────────
 * "Juan Reyes Jr" is Juan / Reyes Jr, not Juan Reyes / Jr — the Philippines
 * writes Jr and III often enough that the naive split is wrong on a real
 * fraction of guest lists, and "Jr" alone on a place card is nobody's name.
 *
 * PURE — no I/O, no clock, no database.
 */

/** Trailing tokens that belong to the surname, matched case- and dot-blind. */
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

const bare = (t: string) => t.replace(/\.+$/, '').toLowerCase();

export function splitPersonName(raw: string): { first: string; last: string } {
  const tokens = (raw ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first: '', last: '' };
  if (tokens.length === 1) return { first: tokens[0]!, last: '' };

  // Walk the suffixes off the end first, so the surname is whatever sits in
  // front of them.
  let cut = tokens.length - 1;
  while (cut > 1 && SUFFIXES.has(bare(tokens[cut]!))) cut -= 1;

  // A name that is ONLY a word and a suffix ("Cher Jr") keeps its shape: one
  // given name, and the rest is the surname half we have.
  return {
    first: tokens.slice(0, cut).join(' '),
    last: tokens.slice(cut).join(' '),
  };
}
