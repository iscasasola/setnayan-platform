/**
 * Capitalise a person's name for display and storage.
 *
 * Owner 2026-08-10: *"Your Name must always have the first letter in capital."*
 * Vendors type their own name in a hurry on a phone — "ana reyes" — and it then
 * appears on their public shop page and in messages to couples.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ────────────────────────────────────────
 * It capitalises the first letter of each word and LEAVES THE REST ALONE. It
 * does not lowercase anything, because the shapes that would break are all real
 * Filipino names: **JR**, **III**, **MJ**, and above all **de la Cruz**,
 * **dela Peña**, **del Rosario** — where the particle is conventionally lower
 * case and "fixing" it to "De La Cruz" is getting someone's name wrong.
 *
 * So `titleCasePersonName('ana reyes')` → `'Ana Reyes'`, and
 * `titleCasePersonName('Juan de la Cruz III')` → unchanged. Only a word that
 * STARTS lower case and was not deliberately typed that way mid-name gets
 * touched — the first word always, later words only when the whole name was
 * typed lower case, which is the actual complaint.
 */

import { PARTICLES } from './person-name-parse';

/** True when the name looks like it was typed without any capitals at all. */
function isAllLower(name: string): boolean {
  return name === name.toLowerCase();
}

function upperFirst(word: string): string {
  // Preserve leading punctuation — "(nickname)" and "'Nay" keep their opener.
  const i = word.search(/[a-zà-öø-ÿ]/i);
  if (i === -1) return word;
  return word.slice(0, i) + word[i]!.toUpperCase() + word.slice(i + 1);
}

export function titleCasePersonName(raw: string | null | undefined): string {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return '';

  // Typed entirely in lower case → capitalise every word. This is the case the
  // owner is complaining about, and the one where no intent can be destroyed:
  // nobody deliberately writes their whole name lower case in a business form.
  if (isAllLower(name)) {
    return name.split(' ').map(upperFirst).join(' ');
  }

  // Otherwise the vendor has capitalised SOMETHING, so their casing is
  // intentional — "Juan de la Cruz", "Ana MJ Reyes". Only guarantee the very
  // first letter, which is what was asked for, and touch nothing else.
  return upperFirst(name);
}

// ── 🪪 DISPLAY — a name reads as a name (owner 2026-10-21, "Yes to all") ──────
//
// The guest page printed what the bringer typed — "pamela labriaga", four times
// (prototype `Setnayan/prototypes/guest_page_fixes_2_4_2026-10-21.html`, fix 3).
// `titleCasePersonName` above would fix that, and would also write
// "Juan De La Cruz". So display gets the shipped rule PLUS one: a particle after
// the first word stays lower case.
//
//   · DISPLAY ONLY. Nothing is written back; the typed name stays in the row
//     (search, the edit boxes, the host's own record). `titleCasePersonName` is
//     still the STORAGE rule where a name is saved cased (a supplier's shop name).
//   · The particles are `PARTICLES` (lib/person-name-parse.ts) — the one list —
//     minus the words that are capitalised in Filipino surnames.
//   · A capital anywhere = typed on purpose: only the first letter is
//     guaranteed, nothing is lowercased ("McArthur", "Ana MJ Reyes" unchanged).
//   · Known limit: an inner capital is never invented ("mcarthur" → "Mcarthur").


/** Particles that are capitalised in Filipino surnames — "Juan San Jose", "Cora Ng". */
const CAPITALISED_IN_SURNAMES: ReadonlySet<string> = new Set(['san', 'santa', 'santo', 'sta', 'sto', 'mac', 'mc', 'ng']);

/** A single letter and a period is a middle initial ("E."), never the particle "e". */
const INITIAL_RE = /^\p{L}\.$/u;

function staysLower(part: string): boolean {
  if (INITIAL_RE.test(part)) return false;
  const key = part.toLowerCase().replace(/[.,]/g, '');
  return PARTICLES.has(key) && !CAPITALISED_IN_SURNAMES.has(key);
}

/**
 * How a person's name is SHOWN — never stored. `displayPersonName('maria dela cruz')`
 * → `'Maria dela Cruz'`; `'dela cruz'` → `'Dela Cruz'` (the first word is always
 * capitalised); `'mary-ann reyes'` → `'Mary-Ann Reyes'` (each half of a hyphen).
 */
export function displayPersonName(raw: string | null | undefined): string {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return '';
  if (!isAllLower(name)) return upperFirst(name);
  return name
    .split(' ')
    .map((word, i) =>
      word
        .split('-')
        .map((part, j) => (i === 0 && j === 0) || !staysLower(part) ? upperFirst(part) : part)
        .join('-'),
    )
    .join(' ');
}

/** The first word of the shown name — "Save Pamela’s ticket", "Hi Pamela!". */
export function displayFirstName(raw: string | null | undefined): string {
  return displayPersonName(raw).split(' ')[0] ?? '';
}
