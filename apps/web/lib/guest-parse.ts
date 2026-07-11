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
 *   • `+N` (`/^\+(\d+)$/`)                   → plusOnes, `min(2, N || 1)`
 *   • `#Word`                               → group name (case preserved, deduped)
 *   • `vip`                                 → roleHint 'vip'
 *   • `sponsor` | `ninong` | `ninang`       → roleHint 'principal_sponsor'
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

/** The structured draft a single Add-mode line parses into. */
export type ParsedGuestDraft = {
  /** First name (word[0]); '' when the line carried no name words. */
  firstName: string;
  /** Last name (words[1..].join(' ')); '' when only one/zero name words. */
  lastName: string;
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
        // Faithful to the prototype: `min(2, parseInt(n) || 1)`, so `+0` → 1 and
        // `+3`/`+9` clamp to 2. The regex only matches digits, so a non-numeric
        // `+x` never reaches here — it stays a name word.
        plusOnes = Math.min(2, Number.parseInt(plusMatch[1] ?? '', 10) || 1);
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
      if (SPONSOR_TOKENS.has(lw)) {
        roleHint = 'principal_sponsor';
        continue;
      }

      words.push(w);
    }
  }

  return {
    firstName: words[0] ?? '',
    lastName: words.slice(1).join(' '),
    side,
    plusOnes,
    groups,
    roleHint,
  };
}
