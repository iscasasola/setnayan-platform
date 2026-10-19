/**
 * guest-title.ts — A GUEST'S TITLE CARRIES WOMAN OR MAN.
 *
 * ⚖ OWNER 2026-10-17, verbatim: *"Find a different approach on how to fix this issue on prefixes which are neutral
 * gender"* → *"or let them choose Atty (Female) or Atty (Male). something like this"* → *"so no need to choose"*.
 *
 * The Title dropdown on the guest card (and in /guests/new) offers every common neutral title TWICE — "Atty. (Woman)" ·
 * "Atty. (Man)" — and the pick writes two columns: `guests.name_prefix` (the title that PRINTS, "Atty.") and
 * `guests.gender` (never printed). There is NO separate Woman · Man question anywhere: the pick IS the answer.
 *
 *   · Mr. · Ms. · Mrs. · Miss already say it — one entry each, and the database keeps their gender
 *     (`guests_title_says_gender_trg`, migration `a_title_carries_woman_or_man`), for every writer.
 *   · A title only one of the two can hold (Fr., Sr. the religious sister) is listed once.
 *   · "Other title…" lets them type their own ("Regional Prosecutor"); the typed title comes back as two entries in the
 *     same list. A stored title outside the list is offered the same way, never dropped.
 *   · "(Woman)" / "(Man)" is the HOST's word in the picker only. Guests and every printed or public surface print the
 *     title alone — `the-title-carries-woman-or-man.test.ts` holds that no public surface prints it.
 *
 * Pure: the card, the Add-guest form, the server actions, the Guests page prompt and the tests all import it.
 */

import type { GuestRole } from './guests';

export type TitleGender = 'woman' | 'man';
export const TITLE_GENDERS: readonly TitleGender[] = ['woman', 'man'];
/** The host's word in the picker — never printed for a guest. */
export const GENDER_WORD: Record<TitleGender, string> = { woman: 'Woman', man: 'Man' };

/**
 * THE FOUR TITLES THAT ALREADY SAY IT — the backfill's whole list, and the trigger's. Nothing else is ever read as a
 * gender: not a neutral title, not a typed one, never a first name. Keys are the title lower-cased without its dot.
 */
export const GENDERED_TITLES: Readonly<Record<string, TitleGender>> = {
  mr: 'man',
  ms: 'woman',
  mrs: 'woman',
  miss: 'woman',
};

/** The four, as the dropdown prints them, in the owner's order. */
export const PLAIN_TITLES = ['Mr.', 'Ms.', 'Mrs.', 'Miss'] as const;

/**
 * The common neutral titles, each listed twice (Woman, then Man) — or once, where only one of the two holds it.
 * Order: the owner's list (Atty. · Dr. · Engr. · Hon. · Judge · Arch. · Prof. · Rev. · Fr. · Sr. · Gen. · Col. · Capt.
 * · Comm. · USec.), with the rest of the old prefix list (`NAME_PREFIX_CHOICES`) beside their kin, so no title a host
 * could pick before is missing now.
 */
export const PAIRED_TITLES: readonly { title: string; only?: TitleGender }[] = [
  { title: 'Atty.' },
  { title: 'Dr.' },
  { title: 'Dra.', only: 'woman' },
  { title: 'Engr.' },
  { title: 'Hon.' },
  { title: 'Judge' },
  { title: 'Arch.' },
  { title: 'Prof.' },
  { title: 'Rev.' },
  { title: 'Pastor' },
  { title: 'Fr.', only: 'man' },
  { title: 'Msgr.', only: 'man' },
  { title: 'Bro.', only: 'man' },
  { title: 'Sr.', only: 'woman' },
  { title: 'Sis.', only: 'woman' },
  { title: 'Gen.' },
  { title: 'Col.' },
  { title: 'Maj.' },
  { title: 'Capt.' },
  { title: 'Lt.' },
  { title: 'Sgt.' },
  { title: 'Comm.' },
  { title: 'USec.' },
];

/** The picker's "Other title…" entry — opens a box to type one's own. */
export const OTHER_TITLE_KEY = '__other__';
export const OTHER_TITLE_LABEL = 'Other title…';
/** The longest title a host may type (matches `guests_name_parts_len_chk`). */
export const TITLE_MAX = 80;

const keyOfTitle = (t: string) => t.trim().toLowerCase().replace(/\.$/, '');

/** Woman / man from a title that says it (Mr. · Ms. · Mrs. · Miss), else null. Case and the trailing dot don't matter. */
export function genderOfTitle(title: string | null | undefined): TitleGender | null {
  if (!title) return null;
  return GENDERED_TITLES[keyOfTitle(title)] ?? null;
}

/** A title, as stored: trimmed, inner spaces collapsed, capped, no "|" (the pick's separator); blank → null. */
export function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX).trim();
  return t || null;
}

const asGender = (raw: unknown): TitleGender | null => (raw === 'woman' || raw === 'man' ? raw : null);

/** The dropdown key of a title + gender: "Atty.|woman" · "Mr.|man" · "|woman" (no title) · "" (nothing). */
export function titleKey(title: string | null | undefined, gender: TitleGender | null | undefined): string {
  const t = cleanTitle(title) ?? '';
  const g = asGender(gender) ?? '';
  return t || g ? `${t}|${g}` : '';
}

/** A dropdown key back into the two columns. A key with no "|" is a bare title (an older form posting it). */
export function parseTitleKey(key: unknown): { name_prefix: string | null; gender: TitleGender | null } {
  if (typeof key !== 'string') return { name_prefix: null, gender: null };
  const bar = key.lastIndexOf('|');
  const name_prefix = cleanTitle(bar < 0 ? key : key.slice(0, bar));
  const said = bar < 0 ? null : asGender(key.slice(bar + 1));
  // A title that says it always wins (the database trigger does the same).
  return { name_prefix, gender: genderOfTitle(name_prefix) ?? said };
}

/** The picker's words for one entry: "Atty. (Woman)" · "Mr." · "No title (Man)" · "—". The HOST'S words only. */
export function titlePickLabel(title: string | null | undefined, gender: TitleGender | null | undefined): string {
  const t = cleanTitle(title);
  const g = asGender(gender);
  if (t && genderOfTitle(t)) return t;
  if (t && g) return `${t} (${GENDER_WORD[g]})`;
  if (t) return t;
  if (g) return `No title (${GENDER_WORD[g]})`;
  return '—';
}

export type TitleChoice = { key: string; label: string };

/** The two entries of one title — or one, where only one of the two holds it, or the title alone when it says it. */
export function choicesOfTitle(title: string): TitleChoice[] {
  const t = cleanTitle(title);
  if (!t) return TITLE_GENDERS.map((g) => ({ key: titleKey(null, g), label: titlePickLabel(null, g) }));
  const said = genderOfTitle(t);
  if (said) return [{ key: titleKey(t, said), label: t }];
  const known = PAIRED_TITLES.find((p) => keyOfTitle(p.title) === keyOfTitle(t));
  const genders = known?.only ? [known.only] : TITLE_GENDERS;
  return genders.map((g) => ({ key: titleKey(t, g), label: titlePickLabel(t, g) }));
}

const isListed = (t: string) =>
  PLAIN_TITLES.some((p) => keyOfTitle(p) === keyOfTitle(t)) || PAIRED_TITLES.some((p) => keyOfTitle(p.title) === keyOfTitle(t));

/**
 * THE TITLE DROPDOWN, in order: — · Mr. · Ms. · Mrs. · Miss · each neutral title twice · No title (Woman / Man) ·
 * "Other title…" (when the surface can take typing). A title outside the list — stored, or just typed — leads, as its
 * own two entries.
 */
export function titleChoices(opts: { current?: string | null; typed?: string | null; other?: boolean } = {}): TitleChoice[] {
  const out: TitleChoice[] = [{ key: '', label: '—' }];
  for (const extra of [opts.typed, opts.current]) {
    const t = cleanTitle(extra);
    if (t && !isListed(t) && !out.some((o) => o.key.startsWith(`${t}|`))) out.push(...choicesOfTitle(t));
  }
  for (const t of PLAIN_TITLES) out.push({ key: titleKey(t, genderOfTitle(t)), label: t });
  for (const p of PAIRED_TITLES) out.push(...choicesOfTitle(p.title));
  out.push(...choicesOfTitle(''));
  if (opts.other) out.push({ key: OTHER_TITLE_KEY, label: OTHER_TITLE_LABEL });
  return out;
}

/**
 * THE ROLES WHOSE PRINTED WORD WAITS ON WOMAN OR MAN — and only those, so the Guests page never asks about a
 * Ninang (her role already says it) or a bridesmaid:
 *   · the parents and grandparents → "Mother / Father of the Groom", "Grandmother / Grandfather of the Bride";
 *   · the LEGACY `principal_sponsor` (from before the Ninong / Ninang split) → which column it prints in.
 */
export const ROLES_WHOSE_WORD_NEEDS_GENDER: readonly GuestRole[] = [
  'bride_parents',
  'groom_parents',
  'bride_grandparents',
  'groom_grandparents',
  'principal_sponsor',
];

type TitleRow = {
  role?: string | null;
  extra_roles?: readonly string[] | null;
  name_prefix?: string | null;
  display_name?: string | null;
  gender?: string | null;
  deleted_at?: string | null;
  passed_away?: boolean | null;
};

/**
 * Title words that say NOTHING about gender — stepped over on the way to one that does (moved here from
 * lib/entourage.ts on 2026-10-17 so the resolver and the Guests page's prompt read titles ONE way). The sort's titles
 * plus the Philippine government and professional honorifics a real guest list carries (73 of 77 guests on one real
 * event held a title, 2026-09-16: Atty., Comm., Associate Dean …).
 */
export const NOT_GENDER_TITLES: ReadonlySet<string> = new Set<string>([
  ...['dr', 'dra', 'hon', 'atty', 'engr', 'arch', 'archt', 'ar', 'rev', 'fr', 'msgr', 'sr', 'sra', 'srta', 'mx'],
  ...['gen', 'col', 'capt', 'maj', 'lt', 'ltc', 'sgt', 'cdr', 'adm', 'brig', 'supt', 'insp', 'ret', 'retd'],
  ...['prof', 'judge', 'justice', 'sen', 'gov', 'mayor', 'rep', 'cong', 'vm', 'vice', 'councilor', 'kgd', 'brgy', 'kap'],
  ...['sec', 'usec', 'asec', 'comm', 'commissioner', 'ombudsman', 'amb', 'ambassador', 'chairman', 'chair', 'chief'],
  ...['pres', 'dir', 'director', 'dean', 'assoc', 'associate', 'cpa', 'rn', 'pastor', 'ptr', 'bishop', 'sis', 'bro'],
]);

/**
 * The title words a person carries, lower-cased, in order: every word of the prefix (it holds titles only), then the
 * display name's LEADING words while they are titles — the first ordinary word ends it, so a first name is never read.
 */
export function titleWordsOf(row: Pick<TitleRow, 'name_prefix' | 'display_name'>): string[] {
  const words = (v: string | null | undefined) => (v ?? '').toLowerCase().split(/[\s.,]+/).filter(Boolean);
  const out = words(row.name_prefix);
  for (const w of words(row.display_name)) {
    if (!GENDERED_TITLES[w] && !NOT_GENDER_TITLES.has(w)) break;
    out.push(w);
  }
  return out;
}

/** Woman / man from the first title WORD that says it ("Atty. Mrs." → woman), else null. */
export function genderOfTitleWords(row: Pick<TitleRow, 'name_prefix' | 'display_name'>): TitleGender | null {
  for (const w of titleWordsOf(row)) if (GENDERED_TITLES[w]) return GENDERED_TITLES[w]!;
  return null;
}

/** Woman / man as the couple entered it: the picked gender first, else a title word that says it. Null when nothing does. */
export function genderOfRow(row: TitleRow): TitleGender | null {
  return asGender(row.gender) ?? genderOfTitleWords(row);
}

/**
 * 👤 WOMAN OR MAN, FOR ONE PERSON — THE ONE READING (owner 2026-10-19, on cale-ice's Me page for the groom's mother:
 * *"shouldn't it identify that she is the female mother of the groom"* · *"not both gender to show?"*).
 *
 *   gender (the "Atty. (Woman)" pick) → a title word that says it (Mr. · Ms. · Mrs. · Miss) → the stored
 *   `guests.attire` (gown → woman, suit → man — the card's old "Attire · 3D seat plan" pick; since 2026-10-20 the card
 *   SAYS the attire their role's dress code gives them, `guestOutfitOf`, and no longer writes it) → null (unknown: a
 *   surface shows both).
 *
 * Every per-person reader goes through here: the parent word (`parentWordOf`, "Mother of the Groom"), and the reader's
 * own column of a two-pick dress-code row (`readerPick` / `readerAttire`: Me › What to wear, the checklist). Nothing is
 * guessed from a first name.
 */
export function womanOrManOf(
  row: Pick<TitleRow, 'name_prefix' | 'display_name' | 'gender'> & { attire?: string | null },
): TitleGender | null {
  return genderOfRow(row) ?? (row.attire === 'gown' ? 'woman' : row.attire === 'suit' ? 'man' : null);
}

/**
 * This person's printed word is waiting on woman or man: they hold a role above (their own or an extra one), and
 * neither a picked gender nor their title says which. Exactly the people the Guests page lists.
 */
export function needsWomanOrMan(row: TitleRow): boolean {
  if (row.deleted_at) return false;
  const roles = [row.role, ...(row.extra_roles ?? [])];
  if (!roles.some((r) => r && (ROLES_WHOSE_WORD_NEEDS_GENDER as readonly string[]).includes(r))) return false;
  return genderOfRow(row) === null;
}

/** The pending pick's words on the card: "Atty. — Woman or Man?" · "No title — Woman or Man?". */
export function pendingTitleText(title: string | null | undefined): string {
  return `${cleanTitle(title) ?? 'No title'} — Woman or Man?`;
}

/**
 * The words on the Title button. A stored title with no gender reads as itself — or, for someone whose printed word
 * waits on it, as the pending pick ("Atty. — Woman or Man?").
 */
export function titleButtonText(title: string | null | undefined, gender: string | null | undefined, needs: boolean): string {
  const g = asGender(gender);
  if (needs && !g && !genderOfTitle(title)) return pendingTitleText(title);
  return titlePickLabel(title, g);
}

/**
 * "(Woman)" / "(Man)" typed in a bulk line or an import's title cell — the host's own mark, read and removed:
 * "Atty. (Woman) Eufemia Cruz" → { text: "Atty. Eufemia Cruz", gender: 'woman' }. Only the exact words, in brackets.
 */
export function takeGenderMark(text: string): { text: string; gender: TitleGender | null } {
  const m = /\s*\((woman|man|female|male)\)\s*/i.exec(text);
  if (!m) return { text, gender: null };
  const w = m[1]!.toLowerCase();
  return {
    text: `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`.replace(/\s+/g, ' ').trim(),
    gender: w === 'woman' || w === 'female' ? 'woman' : 'man',
  };
}
