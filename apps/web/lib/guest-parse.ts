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
 *   • `+Word` naming a role THIS EVENT OFFERS → roleHint (owner 2026-11-01:
 *     "Mr. Roman Atkinson +2 +Groomsmen" → Mr. · Roman Atkinson · +2 ·
 *     Groomsman). Singular or plural, any casing, its label or the couple's own
 *     word for it (`roleWordFor`). A `+Word` that names no offered role is a
 *     GROUP, exactly like `#Word` — never a name word.
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

import { ROLE_LABELS, type GuestGroupCategory, type GuestRole, type GuestSide } from './guests';
import { parsePersonName } from './person-name-parse';
import type { RoleNames } from './role-names';

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
  /** The add card's standard group (Family · Friends · …) — set by the caller, never by the parser. Absent = 'other'. */
  groupCategory?: GuestGroupCategory | null;
};

const SIDE_TOKENS = new Set<GuestSide>(['bride', 'groom', 'both']);
const SPONSOR_TOKENS = new Set(['sponsor', 'ninong', 'ninang']);
const PLUS_RE = /^\+(\d+)$/;
/** `+Word` — a role word or, when it names no offered role, a group. Starts with a letter so `+1` stays plus-ones. */
const PLUS_WORD_RE = /^\+(\p{L}[\p{L}\p{N}'’_-]*)$/u;

/** "Groom's Crew" → "groomscrew": letters and digits only, lower case — how a typed `+Word` and a role's words meet. */
function compact(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * The words a role answers to, in two tiers. FIRST its own name — the label, the label without its "(…)", its key, and
 * the couple's own word for it ("Bride's Crew"); THEN the parts — each "(…)" and each "a / b" half ("Ninong",
 * "Lector", "Officiant"). A part only counts when no role's own name matched, so "+Officiant" is the Officiant even
 * on an event that also offers "Imam / Qadi (Officiant)".
 */
function wordsForRole(role: GuestRole, names: RoleNames | null | undefined): [own: string[], parts: string[]] {
  const label = ROLE_LABELS[role] ?? role;
  const bare = label.replace(/\(.*?\)/g, '');
  const own = new Set<string>([compact(label), compact(role), compact(bare)]);
  const mine = names?.[role];
  if (mine?.one) own.add(compact(mine.one));
  if (mine?.many) own.add(compact(mine.many));
  const parts = new Set<string>();
  for (const m of label.matchAll(/\(([^)]*)\)/g)) parts.add(compact(m[1] ?? ''));
  for (const half of bare.split('/')) parts.add(compact(half));
  own.delete('');
  parts.delete('');
  return [[...own], [...parts]];
}

/** "groomsmen" → groomsman, "bridesmaids" → bridesmaid, "ninongs" → ninong: the singular a plural word may stand for. */
function singulars(w: string): string[] {
  const out = [w];
  if (w.endsWith('men')) out.push(`${w.slice(0, -3)}man`);
  if (w.endsWith('ies')) out.push(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) out.push(w.slice(0, -2));
  if (w.endsWith('s')) out.push(w.slice(0, -1));
  return out;
}

/**
 * The offered role a `+Word` names, or null. A word that could mean TWO offered roles ("+PrincipalSponsor" is both
 * the Ninong and the Ninang) names neither — the parser never guesses between two roles.
 */
export function roleWordFor(
  word: string,
  offeredRoles: readonly GuestRole[],
  names?: RoleNames | null,
): GuestRole | null {
  const typed = compact(word);
  if (!typed) return null;
  const tiers = [new Map<string, Set<GuestRole>>(), new Map<string, Set<GuestRole>>()];
  for (const role of offeredRoles) {
    wordsForRole(role, names).forEach((words, tier) => {
      for (const w of words) {
        const set = tiers[tier]!.get(w) ?? new Set<GuestRole>();
        set.add(role);
        tiers[tier]!.set(w, set);
      }
    });
  }
  for (const index of tiers) {
    for (const cand of singulars(typed)) {
      const hit = index.get(cand);
      if (hit?.size === 1) return [...hit][0]!;
      if (hit) return sponsorWord(typed, offeredRoles);
    }
  }
  return sponsorWord(typed, offeredRoles);
}

/** "+Sponsor" / "+PrincipalSponsors" — the same call as the bare `sponsor` word below (owner 2026-09-15: a sponsor is
 *  the NINONG, a Ninang one dropdown away), when the event offers the Ninong. */
function sponsorWord(typed: string, offeredRoles: readonly GuestRole[]): GuestRole | null {
  const isSponsor = singulars(typed).some((w) => w === 'sponsor' || w === 'principalsponsor');
  return isSponsor && offeredRoles.includes('principal_sponsor_ninong') ? 'principal_sponsor_ninong' : null;
}

/** Every role a draft can be given — used when a caller does not say which roles its event offers (the server still
 *  validates the hint against the event's set, `runAddSingleGuest`). */
const ALL_ROLES = Object.keys(ROLE_LABELS) as GuestRole[];

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
  {
    defaultSide = 'both',
    offeredRoles = ALL_ROLES,
    roleNames = null,
  }: {
    defaultSide?: GuestSide;
    /** The roles THIS event offers — a `+Word` is a role only when it names one of these; otherwise it is a group. */
    offeredRoles?: readonly GuestRole[];
    /** The couple's own role words (`events.role_names`), so "+GroomsCrew" reads as the role they renamed. */
    roleNames?: RoleNames | null;
  } = {},
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

      // ⚖ Owner 2026-11-01: "+Groomsmen" is the ROLE when this event offers it; any other `+Word` is a group, like
      // `#Word`. Digits never reach here (`+2` is plus-ones above).
      const plusWord = w.match(PLUS_WORD_RE);
      if (plusWord) {
        const word = plusWord[1] ?? '';
        const role = roleWordFor(word, offeredRoles, roleNames);
        if (role) roleHint = role;
        else if (!groups.includes(word)) groups.push(word);
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
