/**
 * guest-parse.ts — the PURE Add-grammar parser for the Living Roster capture bar
 * (P2). A faithful port of the prototype's `addGuest` token grammar
 * (scratchpad/guests-prototype.html:853-873), lifted into `lib/` so every rule
 * is a pure function of the raw string with NO React/DOM — unit-tested via
 * `tsx --test` without booting the app.
 *
 * The grammar lets a host type ONE line and get a structured draft:
 *
 *     "Ana Cruz +1 groom vip #Barkada"
 *        → { firstName:'Ana', lastName:'Cruz', side:'groom',
 *            plusOnes:1, groups:['Barkada'], roleHint:'vip' }
 *
 * Token rules (whitespace-split, order-independent; later tokens of the same
 * kind WIN, matching the prototype's overwrite-on-each-token behaviour):
 *   • `bride` | `groom` | `both`            → side
 *   • `+N` (`/^\+(\d+)$/`)                   → plusOnes, clamped 0–4
 *   • `#Word`                               → group name (case preserved, deduped)
 *   • `vip`                                 → roleHint 'vip'
 *   • `ninong` → 'principal_sponsor_ninong'; `ninang` → '..._ninang'
 *   • `sponsor`                              → roleHint 'principal_sponsor_ninong'
 *                                              (owner 2026-09-15; see below)
 *   • everything else                       → a name word (word[0]=first, rest=last)
 *
 * The parser is deliberately schema-DUMB: it returns `roleHint` as a GuestRole
 * candidate but does NOT know the event's offered role set. The consuming server
 * action (`inline-actions.ts › addSingleGuest`) is what validates `roleHint`
 * against `resolveRoleSetForEvent(...).offeredRoles` and falls back to `guest`
 * when the hint isn't offered for that event type — so no validation is weakened
 * here and the same `guest`-fallback happens for a wedding typing `vip`.
 *
 * Keyword matching is case-insensitive; group names and name words keep their
 * original casing.
 */

import type { GuestRole, GuestSide } from './guests';
import { parsePersonName } from './person-name-parse';

/** The structured draft a single Add-mode line parses into. */
export type ParsedGuestDraft = {
  /** Honorific(s) — "Atty.", "Associate Dean". '' when the line carried none. */
  prefix: string;
  /** Given name; '' when the line carried no name words. */
  firstName: string;
  /** Name between first and last, usually an initial. '' when absent. */
  middleName: string;
  /** Family name, particle included ("dela Peña"); '' for a mononym. */
  lastName: string;
  /** Generational / post-nominal — "Jr.", "III". '' when absent. */
  suffix: string;
  /** Which side the guest belongs to; falls back to `defaultSide` then 'both'. */
  side: GuestSide;
  /** Plus-one count, 0–2 (see `+N` rule; `+0` → 1, mirroring the prototype). */
  plusOnes: number;
  /** `#Group` names in first-seen order, de-duplicated, original casing kept. */
  groups: string[];
  /** A role candidate from `vip` / `sponsor|ninong|ninang`; null otherwise.
   *  NOT validated against the event's role set — the caller does that. */
  roleHint: GuestRole | null;
};

const SIDE_TOKENS = new Set<GuestSide>(['bride', 'groom', 'both']);
const SPONSOR_TOKENS = new Set(['sponsor', 'ninong', 'ninang']);
const PLUS_RE = /^\+(\d+)$/;

/**
 * Parse a raw capture-bar line into a structured guest draft.
 *
 * @param raw          the line the host typed.
 * @param defaultSide  the side to use when the line names none — the capture bar
 *                     passes the active Side filter so a new guest inherits the
 *                     lens the host is standing in (prototype `:855`). Defaults
 *                     to 'both'.
 */
export function parseGuestInput(
  raw: string,
  { defaultSide = 'both' }: { defaultSide?: GuestSide } = {},
): ParsedGuestDraft {
  const str = (raw ?? '').trim();

  let side: GuestSide = defaultSide;
  let plusOnes = 0;
  let roleHint: GuestRole | null = null;
  const groups: string[] = [];
  const words: string[] = [];

  if (str) {
    for (const w of str.split(/\s+/)) {
      const lw = w.toLowerCase();

      if (SIDE_TOKENS.has(lw as GuestSide)) {
        side = lw as GuestSide;
        continue;
      }

      const plusMatch = w.match(PLUS_RE);
      if (plusMatch) {
        // Read the digits honestly and clamp to 0–4: `+0` → 0 (a "+0" reads as
        // NONE, so it must not grant a phantom +1 the way the prototype's
        // `|| 1` did), `+3` → 3, `+9` → 4. The regex only matches digits, so a
        // non-numeric `+x` never reaches here — it stays a name word.
        // ⚖ Owner 2026-09-21: "+1 per guest can be up to number 4". The count
        // column this note used to say was missing now exists
        // (`guests.plus_one_count`), so the number typed is the number saved.
        const n = Number.parseInt(plusMatch[1] ?? '', 10);
        plusOnes = Number.isFinite(n) ? Math.min(4, Math.max(0, n)) : 0;
        continue;
      }

      if (w.startsWith('#')) {
        const name = w.slice(1);
        if (name && !groups.includes(name)) groups.push(name);
        continue;
      }

      if (lw === 'vip') {
        roleHint = 'vip';
        continue;
      }
      // Split 2026-09-14: `ninong` and `ninang` name WHICH half of a principal
      // pair the guest is, so they tag the specific role.
      //
      // A bare `sponsor` cannot know — guests carry no gender, and deriving it
      // from `side` is the bug this split exists to kill (a Ninong standing on
      // the bride's side is not a Ninang). It used to fall back to the plain
      // `principal_sponsor`, which the owner RETIRED on 2026-09-15.
      //
      // Owner's call, asked directly: `sponsor` → NINONG. Not a coin flip —
      // Ninong is first in ROLE_IMPORTANCE, first in the bulk picker and first
      // in the roster's sections, so the shortcut agrees with every ordering in
      // the app, and a Ninang is one dropdown away. The alternative considered
      // and rejected was landing them as a plain Guest: that writes no wrong
      // value but silently ignores a word the host deliberately typed.
      if (lw === 'ninong') {
        roleHint = 'principal_sponsor_ninong';
        continue;
      }
      if (lw === 'ninang') {
        roleHint = 'principal_sponsor_ninang';
        continue;
      }
      if (SPONSOR_TOKENS.has(lw)) {
        roleHint = 'principal_sponsor_ninong';
        continue;
      }

      words.push(w);
    }
  }

  // The leftover name words are split by the ONE shared parser, so the capture
  // bar, the detailed form, the import and the detail editor all agree on where
  // a title ends and a given name begins. This used to be
  // `words[0] = first, words.slice(1) = last`, which stored the honorific AS the
  // first name — see person-name-parse.ts for the 30-of-100 prod measurement.
  const name = parsePersonName(words.join(' '));

  return {
    prefix: name.prefix,
    firstName: name.firstName,
    middleName: name.middleName,
    lastName: name.lastName,
    suffix: name.suffix,
    side,
    plusOnes,
    groups,
    roleHint,
  };
}
