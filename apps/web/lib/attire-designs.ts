/**
 * lib/attire-designs.ts — EACH ROLE'S OWN LIST OF DESIGNS, AND THE DRAWING FOR EACH.
 *
 * Owner 2026-10-16 (DECISION_LOG "EACH ROLE HAS ITS OWN LIST OF DESIGNS — NOT ONE GLOBAL WEAR LIST"): *"so for each
 * role, we have a specific design they can choose from. for example groom. The groom can be Suit and Tie, 3 Piece Suit,
 * Barong Tagalog"* — and, the same day, "APPROVED — ALL 45 ROLE × DESIGN DRAWINGS; THE PER-ROLE ATTIRE BUILD STARTS":
 * *"Approved — use all 45 drawings and start the per-role attire build."*
 *
 * A role's Wear ▾ lists THAT role's designs (`ROLE_DESIGNS`), each drawn as that role (`public/attire/roles/<role>-
 * <design>.webp`, built by `scripts/build-role-attire.py`) in its own colour zones (`DESIGN_ZONES`, lib/attire-figures.ts).
 * This supersedes the global `ATTIRE_STYLES` list as what a role's Wear ▾ offers; rows with no list of their own (the
 * celebrant, Nikah principals, officiants & readers) keep the shipped seven (`GENERAL_ATTIRE_STYLES`).
 *
 * 🔑 THE STORED SHAPE DID NOT CHANGE. A design is stored where a style always was (`dress_code_config[tier][key].style`,
 * the second pick in `women`) — the vocabulary grew by eight words (`ATTIRE_STYLES`). A design is keyed by its GARMENT
 * (`filipiniana`, `long_gown`…) and named per role ("Filipiniana (terno)" for the bride, "Filipiniana dress" for the
 * flower girl, "Long dress" for a guest), so every Wear stored before this reads into the role's own design untouched.
 *
 * 🔁 OLD WORDS (`designOf`): a stored style the role lists is that design; two words with an exact meaning are read into
 * the role's design — `formal` (Tuxedo for a man, Long gown for a woman) and a boy's `suit` (the boy's suit was drawn as
 * the vest and bow tie). Anything else reads "Not said yet" — never the nearest design (2026-09-20, "There is no default").
 *
 * Pure data, no DOM, no React.
 */
import type { FigureWho } from './attire-figures';
import { ATTIRE_STYLE_LABEL, type AttireStyle } from './role-dress-code';

/** The seventeen people drawn — every role on the approved prompt page (15 + the two guests). */
export const FIGURE_ROLES = [
  'groom',
  'best_man',
  'groomsman',
  'ninong',
  'father',
  'sponsor_m',
  'bride',
  'maid_of_honor',
  'bridesmaid',
  'ninang',
  'mother',
  'sponsor_w',
  'ring_bearer',
  'bible_bearer',
  'flower_girl',
  'guest_m',
  'guest_w',
] as const;
export type FigureRole = (typeof FIGURE_ROLES)[number];

/** Who each is — a man, a woman, a boy or a girl. */
export const FIGURE_ROLE_WHO: Readonly<Record<FigureRole, FigureWho>> = {
  groom: 'm',
  best_man: 'm',
  groomsman: 'm',
  ninong: 'm',
  father: 'm',
  sponsor_m: 'm',
  bride: 'f',
  maid_of_honor: 'f',
  bridesmaid: 'f',
  ninang: 'f',
  mother: 'f',
  sponsor_w: 'f',
  ring_bearer: 'boy',
  bible_bearer: 'boy',
  flower_girl: 'girl',
  guest_m: 'm',
  guest_w: 'f',
};

/** One design on a role's Wear ▾: the stored word and the role's own name for it. */
export type RoleDesign = { readonly style: AttireStyle; readonly label: string };
const d = (style: AttireStyle, label: string): RoleDesign => ({ style, label });

/**
 * THE TABLE (DECISION_LOG 2026-10-16, in its order). Every row has a drawing — 45 in all (`roleArtKey`).
 */
export const ROLE_DESIGNS: Readonly<Record<FigureRole, readonly RoleDesign[]>> = {
  groom: [d('suit', 'Suit and tie'), d('three_piece_suit', '3-piece suit'), d('barong_tagalog', 'Barong Tagalog'), d('tuxedo', 'Tuxedo')],
  best_man: [d('suit', 'Suit and tie'), d('three_piece_suit', '3-piece suit'), d('barong_tagalog', 'Barong Tagalog'), d('tuxedo', 'Tuxedo')],
  groomsman: [d('suit', 'Suit and tie'), d('vest_and_tie', 'Vest and tie'), d('barong_tagalog', 'Barong Tagalog')],
  ninong: [d('barong_tagalog', 'Barong Tagalog'), d('suit', 'Suit and tie')],
  father: [d('barong_tagalog', 'Barong Tagalog'), d('suit', 'Suit and tie')],
  sponsor_m: [d('barong_tagalog', 'Barong Tagalog'), d('suit', 'Suit and tie')],
  bride: [d('ball_gown', 'Ball gown'), d('mermaid', 'Mermaid'), d('a_line', 'A-line'), d('filipiniana', 'Filipiniana (terno)')],
  maid_of_honor: [d('long_gown', 'Long gown'), d('cocktail_dress', 'Cocktail dress'), d('filipiniana', 'Filipiniana')],
  bridesmaid: [d('long_gown', 'Long gown'), d('cocktail_dress', 'Cocktail dress'), d('filipiniana', 'Filipiniana')],
  ninang: [d('filipiniana', 'Filipiniana'), d('long_gown', 'Long gown')],
  mother: [d('filipiniana', 'Filipiniana'), d('long_gown', 'Long gown')],
  sponsor_w: [d('long_gown', 'Long gown'), d('filipiniana', 'Filipiniana')],
  ring_bearer: [d('vest_and_bow_tie', 'Vest and bow tie'), d('barong_tagalog', 'Barong Tagalog')],
  bible_bearer: [d('vest_and_bow_tie', 'Vest and bow tie'), d('barong_tagalog', 'Barong Tagalog')],
  flower_girl: [d('tulle_dress', 'Tulle dress'), d('filipiniana', 'Filipiniana dress')],
  guest_m: [d('barong_tagalog', 'Barong Tagalog'), d('suit', 'Suit and tie'), d('smart_casual', 'Smart casual')],
  guest_w: [d('long_gown', 'Long dress'), d('cocktail_dress', 'Cocktail dress'), d('filipiniana', 'Filipiniana')],
};

/** A role's designs, as stored words, in its Wear ▾ order. */
export function roleDesigns(role: FigureRole): readonly AttireStyle[] {
  return ROLE_DESIGNS[role].map((x) => x.style);
}

/**
 * 🔁 Two old words with ONE meaning per person (the brief's mapping, 2026-10-16). Nothing else is ever re-read.
 *   · `formal` — a man's is the Tuxedo, a woman's the Long gown (the old figure drew a man's "Formal" as black tie and a
 *     woman's as the gown);
 *   · a BOY's `suit` — the boy's suit was drawn as the vest and bow tie (`suitb`), so that is what the couple saw.
 */
export const OLD_WORDS: Readonly<Partial<Record<AttireStyle, Partial<Record<FigureWho, AttireStyle>>>>> = {
  formal: { m: 'tuxedo', f: 'long_gown' },
  suit: { boy: 'vest_and_bow_tie' },
};

/** The design a stored Wear is for THIS role — its own, an old word with one meaning, or null ("Not said yet"). */
export function designOf(role: FigureRole, stored: AttireStyle | null | undefined): AttireStyle | null {
  if (!stored) return null;
  const own = roleDesigns(role);
  if (own.includes(stored)) return stored;
  const read = OLD_WORDS[stored]?.[FIGURE_ROLE_WHO[role]];
  return read && own.includes(read) ? read : null;
}

/** The role's own name for a design ("Filipiniana (terno)"), or the shared word when the role does not list it. */
export function designLabel(role: FigureRole | null | undefined, style: AttireStyle): string {
  return (role ? ROLE_DESIGNS[role].find((x) => x.style === style)?.label : undefined) ?? ATTIRE_STYLE_LABEL[style];
}

/** The drawing of a role in a design — `<role>-<design>` (public/attire/roles/), or null when the role has no such design. */
export function roleArtKey(role: FigureRole, style: AttireStyle | null | undefined): `${FigureRole}-${AttireStyle}` | null {
  return style && roleDesigns(role).includes(style) ? `${role}-${style}` : null;
}

/* ── which people a Studio row draws ─────────────────────────────────────── */

/**
 * A row's columns, as figure roles — first (men · boys), second (women · girls), matching `ATTIRE_ROWS[].who`.
 * A row with none here (the celebrant, Nikah principals, officiants & readers) keeps the shipped seven styles.
 */
export const ROW_FIGURE_ROLES: Readonly<Record<string, readonly [FigureRole] | readonly [FigureRole, FigureRole]>> = {
  bride: ['bride'],
  groom: ['groom'],
  vip_family: ['father', 'mother'],
  principal_sponsors: ['ninong', 'ninang'],
  secondary_sponsors: ['sponsor_m', 'sponsor_w'],
  /* 👯 The honour attendants' rows (owner 2026-10-19, "Best man and best woman share a row like principal sponsors.
     same goes to maid and matron of honor"): the best man wears the groom's list, the best woman the maid of honor's. */
  best_man: ['best_man', 'maid_of_honor'],
  maid_of_honor: ['maid_of_honor'],
  bridesmaids: ['bridesmaid'],
  groomsmen: ['groomsman'],
  bearers_flower_girl: ['ring_bearer', 'flower_girl'],
  guest: ['guest_m', 'guest_w'],
};

/** The figure role of one column of a row, or null for a row without a list of its own. */
export function columnRole(rowKey: string, index: 0 | 1 = 0): FigureRole | null {
  const roles = ROW_FIGURE_ROLES[rowKey];
  return roles ? (roles[index] ?? null) : null;
}

/* ── which person a READER is ───────────────────────────────────────────── */

/**
 * A guest-list role → the person drawn for them: one role (a ninang), or a pair the page picks between by what the
 * couple marked them as wearing (a parent, a candle sponsor, a plain guest). Roles with no drawing of their own (`best_woman` —
 * the best man's designs are a man's —, officiants, the celebrant, Nikah principals) are absent — they keep the shipped figures.
 */
export const READER_FIGURE: Readonly<Partial<Record<string, FigureRole | readonly [FigureRole, FigureRole]>>> = {
  groom: 'groom',
  best_man: 'best_man',
  groomsman: 'groomsman',
  bride: 'bride',
  maid_of_honor: 'maid_of_honor',
  matron_of_honor: 'maid_of_honor',
  /* 🤵‍♂️ The man of honor (owner 2026-10-19) wears the best man's list — the same four drawings (#02/#21/#22/#23). */
  man_of_honor: 'best_man',
  bridesmaid: 'bridesmaid',
  principal_sponsor_ninong: 'ninong',
  principal_sponsor_ninang: 'ninang',
  principal_sponsor: ['ninong', 'ninang'],
  bride_parents: ['father', 'mother'],
  groom_parents: ['father', 'mother'],
  bride_grandparents: ['father', 'mother'],
  groom_grandparents: ['father', 'mother'],
  bride_immediate_family: ['father', 'mother'],
  groom_immediate_family: ['father', 'mother'],
  candle_sponsor: ['sponsor_m', 'sponsor_w'],
  veil_sponsor: ['sponsor_m', 'sponsor_w'],
  cord_sponsor: ['sponsor_m', 'sponsor_w'],
  coin_sponsor: ['sponsor_m', 'sponsor_w'],
  ring_bearer: 'ring_bearer',
  bible_bearer: 'bible_bearer',
  coin_bearer: 'bible_bearer',
  flower_girl: 'flower_girl',
  guest: ['guest_m', 'guest_w'],
};

/** The reader's own figure role for one person of theirs (`who`), or null. */
export function readerFigureRole(role: string | null | undefined, who: FigureWho): FigureRole | null {
  const r = role ? READER_FIGURE[role] : undefined;
  if (!r) return null;
  if (typeof r === 'string') return FIGURE_ROLE_WHO[r] === who ? r : null;
  return r.find((x) => FIGURE_ROLE_WHO[x] === who) ?? null;
}

/* ── colours ─────────────────────────────────────────────────────────────── */

/**
 * 👗 GUESTS: UP TO FIVE COLOUR OPTIONS (owner 2026-10-16: *"we most likely will have max of 5 guests palettes"*). Each
 * option is drawn as its own figure, side by side. Held by `PALETTE_LIMITS.guest.max` and the women's own colours
 * (`sanitizeSecondPicks`).
 */
export const GUEST_OPTIONS_MAX = 5;

/* ── one line of words for a role or a group ─────────────────────────────── */

/**
 * How a stored Wear is SAID for a guest-list role or a group (the guest page's role rows): a one-person role or a
 * one-column group in its own word for the design ("Filipiniana (terno)"), or `null` when the Wear is not theirs — the
 * line then says nothing rather than a garment they would not wear. A role or group of two people (sponsors, parents,
 * guests) keeps the shared word: its row names each column on its own lines.
 */
export function wearLabelFor(roleOrGroup: string, style: AttireStyle): string | null {
  const one = READER_FIGURE[roleOrGroup] ?? (ROW_FIGURE_ROLES[roleOrGroup]?.length === 1 ? ROW_FIGURE_ROLES[roleOrGroup]![0] : undefined);
  if (typeof one !== 'string') return ATTIRE_STYLE_LABEL[style];
  const design = designOf(one, style);
  return design ? designLabel(one, design) : null;
}
