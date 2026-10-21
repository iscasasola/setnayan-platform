/**
 * lib/attire-rows.ts — WHO EACH ATTIRE ROW DRESSES, AND WHERE A ROW'S SECOND PICK IS KEPT.
 *
 * Owner 2026-10-14 (DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"; prototype
 * `maker_effects_and_attire_2026-10-14_fable.html`, `ROLES` / blocks): *"VIP, immediate family, secondary sponsor and
 * guests have both genders. so let them pick an attire for male and attire for female"* — and, asked, *"Yes, two
 * picks"* for Principal Sponsors and for Bearers & Flower Girl (boys / girls) too.
 *
 *   one pick  — the bride (a woman) · the groom (a man) · bridesmaids · groomsmen · Nikah principals · officiants ·
 *               the celebrant
 *   two picks — VIP · Immediate Family · Principal Sponsors · Secondary Sponsors · Guests (men / women) and
 *               Bearers & Flower Girl (boys / girls)
 *
 * ── WHERE THE TWO PICKS LIVE ───────────────────────────────────────────────
 * The FIRST pick (men, or boys) is the row as it has always been stored — its Wear is `dress_code_config[tier][key]
 * .style` and its colours are the row's Mood Board colours (`role_palette[paletteKey]`), so every surface that already
 * reads them (the 3D room, the prints, the reminders) keeps reading exactly what it did.
 * The SECOND pick (women, or girls) is `dress_code_config.women[tier][key]` = `{ style?, colours? }`:
 *   · `style` ABSENT — the row's one Wear, as stored before the split (a row saved with one answer meant everyone);
 *     `style: null` — said: "Not said yet" for the women, whatever the men wear;
 *   · `colours` ABSENT — the row's own colours; present — the women's own.
 * Why not `role_palette`: it is a CLOSED vocabulary — `sanitizeRolePalette` keeps only PaletteKeys, so a second key
 * there would be dropped on the next save without a word. `dress_code_config` is the dress code's own JSON (the draft
 * holds it as sent, Apply publishes it as drafted); `women` is one more part of it, read through `sanitizeSecondPicks`
 * below and carried by the one writer that rebuilds the whole config (`updateDressCode`).
 *
 * 🔑 FIRST WRITE PINS THE OTHER HALF. A row saved before the split holds one Wear for everyone. The first time the
 * couple changes the MEN's Wear, the women's is first written down as what it was (`withFirstStyle`), so it never
 * moves under them.
 *
 * Pure, client-safe.
 */
import { isAttireStyle, type AttireStyle } from './role-dress-code';
import { COUNTERPART, STYLE_ORDER, fitsWho, type FigureWho } from './attire-figures';
import { GUEST_OPTIONS_MAX, columnRole, designLabel, designOf, readerFigureRole, roleDesigns, type FigureRole } from './attire-designs';
import type { GuestAttire, GuestRole } from './guests';
import type { PaletteKey } from './mood-board';
import { roleGroupOf } from './role-groups';
import { roleLabel } from './entourage';
import { womanOrManOf } from './guest-title';
import type { RoleNames } from './role-names';

const roleGroupOfRole = (role: GuestRole): string | null => {
  const g = roleGroupOf(role);
  return g === 'guest' ? null : g;
};

export type AttireTier = 'roles' | 'groups';

export type AttireRowDef = {
  tier: AttireTier;
  key: string;
  /** The Mood Board palette that colours the row — null for one with no palette of its own (the celebrant). */
  paletteKey: PaletteKey | null;
  /** Who the row dresses: one person, or two picks — first (men · boys), second (women · girls). */
  who: readonly [FigureWho] | readonly [FigureWho, FigureWho];
  /**
   * A ONE-pick row whose people may be EITHER (the celebrant, Nikah principals, officiants & readers): drawn as its
   * usual wearer, but its Wear ▾ keeps every style — a reader or a judge may wear a gown — and the figure is the person
   * whose style it is (`pickOptions`, `picksOf`).
   */
  either?: true;
  /**
   * 🤵‍♂️ A TWO-PICK row whose SECOND column is drawn only when its person is on the guest list or it already holds a
   * pick (`shownColumns`) — the man of honor's in "Maid of Honor & Matron of Honor" (owner 2026-10-19). Every live
   * wedding's maid row was one woman; an empty FOR MEN column on every one of them would be clutter nobody asked for.
   * The column never inherits the first column's Wear either: the maid's gown said nothing about a man.
   */
  optionalSecond?: true;
};

/**
 * Every row the Studio's Attire can draw, in the Mood Board's order (`studioAttireRows` picks the ones on the guest
 * list). A one-pick row whose people may be either (Nikah principals, officiants, the celebrant) is drawn as the
 * role's usual wearer — a build call, said in the handover.
 */
export const ATTIRE_ROWS: readonly AttireRowDef[] = [
  { tier: 'roles', key: 'celebrant', paletteKey: null, who: ['f'], either: true },
  { tier: 'roles', key: 'bride', paletteKey: 'bride', who: ['f'] },
  { tier: 'roles', key: 'groom', paletteKey: 'groom', who: ['m'] },
  { tier: 'groups', key: 'vip_family', paletteKey: 'parents_immediate_family', who: ['m', 'f'] },
  { tier: 'groups', key: 'principal_sponsors', paletteKey: 'principal_sponsors', who: ['m', 'f'] },
  { tier: 'groups', key: 'secondary_sponsors', paletteKey: 'secondary_sponsors', who: ['m', 'f'] },
  { tier: 'groups', key: 'muslim_principals', paletteKey: 'muslim_principals', who: ['m'], either: true },
  /* 👯 THE HONOUR ATTENDANTS, at the head of the entourage (owner 2026-10-19: *"Best man and best woman share a row like
     principal sponsors. same goes to maid and matron of honor"*). Each row is keyed by the role it is named for and
     coloured by the Mood Board slot that already covers the pair (`maid_of_honor` "Maid / Matron / Man of Honor",
     `best_man` "Best Man / Best Woman"); the matron of honor, the man of honor and the best woman read it too
     (`HONOUR_ROW_OF`).
     🤵‍♂️ The maid's row is FOR WOMEN (the maid and the matron — one woman, one pick: owner 2026-10-19, *"maid/matron
     of honor can have the same character. both female"*) and FOR MEN (the man of honor: *"but also want a man of
     honor option"*). Women first, so every Wear already stored for the maid stays the FIRST pick, where it always was. */
  { tier: 'roles', key: 'maid_of_honor', paletteKey: 'maid_of_honor', who: ['f', 'm'], optionalSecond: true },
  { tier: 'roles', key: 'best_man', paletteKey: 'best_man', who: ['m', 'f'] },
  { tier: 'groups', key: 'bridesmaids', paletteKey: 'bridesmaids', who: ['f'] },
  { tier: 'groups', key: 'groomsmen', paletteKey: 'groomsmen', who: ['m'] },
  { tier: 'groups', key: 'bearers_flower_girl', paletteKey: 'bearers_flower_girl', who: ['boy', 'girl'] },
  { tier: 'groups', key: 'officiants', paletteKey: 'officiants', who: ['m'], either: true },
  { tier: 'roles', key: 'guest', paletteKey: 'guest', who: ['m', 'f'] },
];

export function attireRow(tier: AttireTier, key: string): AttireRowDef | null {
  return ATTIRE_ROWS.find((r) => r.tier === tier && r.key === key) ?? null;
}
export function attireRowOfPalette(paletteKey: string): AttireRowDef | null {
  return ATTIRE_ROWS.find((r) => r.paletteKey === paletteKey) ?? null;
}
/**
 * 👯 THE HONOUR ATTENDANTS' ROWS (owner 2026-10-19): each honour role → the row it is dressed by and its column there.
 * The best man is the men's column of "Best Man & Best Woman", the best woman its women's; the maid and the matron of
 * honor share the women's column of the maid's row, and the man of honor is its men's column.
 */
export const HONOUR_ROW_OF: Readonly<Partial<Record<GuestRole, { key: 'best_man' | 'maid_of_honor'; index: 0 | 1 }>>> = {
  maid_of_honor: { key: 'maid_of_honor', index: 0 },
  matron_of_honor: { key: 'maid_of_honor', index: 0 },
  man_of_honor: { key: 'maid_of_honor', index: 1 },
  best_man: { key: 'best_man', index: 0 },
  best_woman: { key: 'best_man', index: 1 },
};
/** The honour roles each honour row is named for, in its order (the row is labelled with the ones on the guest list). */
export const HONOUR_ROW_ROLES: Readonly<Record<'best_man' | 'maid_of_honor', readonly GuestRole[]>> = {
  maid_of_honor: ['maid_of_honor', 'matron_of_honor', 'man_of_honor'],
  best_man: ['best_man', 'best_woman'],
};
/** The roles a row's heading ALWAYS names (the pair the owner named on 2026-10-19), before any optional one. */
const HONOUR_ROW_ALWAYS: Readonly<Record<'best_man' | 'maid_of_honor', readonly GuestRole[]>> = {
  maid_of_honor: ['maid_of_honor', 'matron_of_honor'],
  best_man: ['best_man', 'best_woman'],
};
/**
 * An honour row's heading — ALWAYS BOTH NAMES of its pair, each in the couple's own word (owner 2026-09-30, "THE
 * COUPLE NAMES THEIR ROLES"): "Maid of Honor & Matron of Honor", "Best Man & Best Woman". Owner 2026-10-19, on a row
 * that read "Maid of Honor" for a list with no matron: *"maid and matron of honor same row"* — the row is the pair's,
 * whichever of the two the guest list holds; the Studio, the guest page and the prints all say it the same way.
 */
export function honourRowLabel(key: 'best_man' | 'maid_of_honor', names?: RoleNames | null, withOptional = false): string {
  /* 🤵‍♂️ TITLE DECISION (2026-10-19, rd/man-of-honor): the man of honor is named only when his column is drawn — he is
     on the guest list, or his column holds a pick (`shownColumns`). Three names share their tail when they can, so the
     heading fits a 375 px phone: "Maid, Matron & Man of Honor" (27 characters — shorter than the shipped
     "Maid of Honor & Matron of Honor"). A renamed role keeps its whole word: "Maid of Honor, Ate Lia & Man of Honor". */
  const roles = withOptional ? HONOUR_ROW_ROLES[key] : HONOUR_ROW_ALWAYS[key];
  const words = roles.map((r) => roleLabel(r, names) ?? r);
  if (words.length <= 2) return words.join(' & ');
  const TAIL = ' of Honor';
  const shared = words.every((w) => w.endsWith(TAIL) && w.length > TAIL.length);
  const parts = shared ? words.map((w, i) => (i === words.length - 1 ? w : w.slice(0, -TAIL.length))) : words;
  return `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}`;
}
/**
 * 🤵‍♂️ THE COLUMNS A ROW DRAWS: every column, except an `optionalSecond` row's second, which is drawn only when its
 * person is on the guest list (`present`, the Studio's `honourColumns`) or it already holds a Wear or its own colours —
 * so a pick is never hidden where it cannot be taken back.
 */
export function shownColumns(config: Config, row: AttireRowDef, present?: ReadonlyArray<0 | 1>): Array<0 | 1> {
  const all = row.who.map((_, i) => i as 0 | 1);
  if (!row.optionalSecond) return all;
  const second = sanitizeSecondPicks(config?.women)[row.tier]?.[row.key];
  const held = Boolean(second && (second.style || second.colours));
  return present?.includes(1) || held ? all : [0];
}
export const isHonourRowKey = (key: string): key is 'best_man' | 'maid_of_honor' => key === 'best_man' || key === 'maid_of_honor';
export const isHonourRole = (role: string | null | undefined): boolean => Boolean(role && HONOUR_ROW_OF[role as GuestRole]);

/**
 * 🔑 AN HONOUR ROW SPEAKS FOR ITS PERSON ONCE THEIR WEAR IS PICKED. Until the couple picks what the reader's column
 * wears, an honour attendant keeps their group's look (the Bridesmaids, the Groomsmen) — exactly what they read before
 * the row existed, so no event loses what it has. Colours alone do not switch it: the two palette slots were the old
 * dress-code panel's, and a guest is not moved off their group by a colour nobody picked in this row.
 */
export function honourRowSpeaks(config: Config, role: GuestRole | null | undefined): boolean {
  const at = role ? HONOUR_ROW_OF[role] : undefined;
  if (!at) return false;
  const row = attireRow('roles', at.key);
  return Boolean(row && picksOf(config, row)[at.index]?.style);
}

/**
 * 🪞 THE STUDIO ROW A GUEST-LIST ROLE IS DRESSED BY (2026-10-17, "ONE FACT"): its own row for the four the Studio
 * lists by role (the celebrant, the bride, the groom, the guests), else its group's row (a ninang → Principal
 * Sponsors, the groom's parents → VIP · Immediate Family). Null for a role the Studio has no row for. Every reader of
 * "what does this person wear" goes through it, so the guest page answers from the row the couple picked on — never
 * from a second store the editor does not show.
 *
 * 👯 An honour attendant (2026-10-19) is dressed by their honour row once `config` shows their Wear picked there
 * (`honourRowSpeaks`), else by their group's row — the Bridesmaids, the Groomsmen. Without `config` (a caller that
 * asks only which group a role belongs to) it is the group's row, as before.
 */
export function studioRowOf(role: GuestRole | null | undefined, config?: Config): AttireRowDef | null {
  if (!role) return null;
  const honour = HONOUR_ROW_OF[role];
  if (honour && config !== undefined && honourRowSpeaks(config, role)) return attireRow('roles', honour.key);
  const own = honour ? null : attireRow('roles', role);
  if (own) return own;
  const group = roleGroupOfRole(role);
  return group ? attireRow('groups', group) : null;
}
/**
 * 🪞 A ROLE THAT MAY CARRY ITS OWN WEAR in `dress_code_config.roles`: the entourage's roles (`roleLabel`) AND the four
 * the Studio lists by themselves — the celebrant, the bride, the groom, the guests (2026-10-17). Every reader of the
 * stored roles keeps these; the old filter (`roleLabel` alone — the entourage's list) silently dropped the bride's,
 * the groom's and the guests' Wear on the way into the Studio, so the editor showed "Not said yet" for a saved pick
 * and its next save wrote the config back without it.
 */
export function isDressableRole(v: string): boolean {
  return roleLabel(v as GuestRole) !== null || attireRow('roles', v) !== null;
}
export const isTwoPick = (row: AttireRowDef | null): boolean => (row?.who.length ?? 0) === 2;

/**
 * 👫 ONE COLUMN'S Wear ▾ (owner 2026-10-16: *"the drawing is not following the type of attire"*): a column lists only
 * its own person's styles (`STYLE_ORDER` — a men's column never offers "Long gown"); an `either` row lists its usual
 * wearer's first, then the rest.
 */
export function pickOptions(row: AttireRowDef, index: 0 | 1 = 0): readonly AttireStyle[] {
  /* 👔 A row with its own designs (owner 2026-10-16, "EACH ROLE HAS ITS OWN LIST OF DESIGNS") lists THAT role's. */
  const role = columnRole(row.key, index);
  if (role) return roleDesigns(role);
  const who = row.who[index] ?? row.who[0];
  if (row.who.length === 1 && row.either) return [...STYLE_ORDER[who], ...STYLE_ORDER[COUNTERPART[who]].filter((s) => !STYLE_ORDER[who].includes(s))];
  return STYLE_ORDER[who];
}

/** The block labels the couple reads above each pick. */
export const PICK_LABEL: Readonly<Record<FigureWho, string>> = { m: 'For men', f: 'For women', boy: 'For boys', girl: 'For girls' };

/* ── the second pick, stored ─────────────────────────────────────────────── */

export type SecondPick = { style?: AttireStyle | null; colours?: string[] };
export type SecondPicks = { roles?: Record<string, SecondPick>; groups?: Record<string, SecondPick> };

const HEX = /^#[0-9a-fA-F]{6}$/;
/** As many colours as a role's own palette holds — and the guests' options, at most five (owner 2026-10-16,
 *  `GUEST_OPTIONS_MAX` = `PALETTE_LIMITS.guest.max`). */
export const SECOND_PICK_COLOURS_MAX = 6;
export const secondPickColoursMax = (key: string): number => (key === 'guest' ? GUEST_OPTIONS_MAX : SECOND_PICK_COLOURS_MAX);

/**
 * `dress_code_config.women` from whatever is stored — only the two-pick rows, a known style or an explicit null, real
 * hex colours. Anything else is dropped (a reader of stored data shows only what it can vouch for).
 */
export function sanitizeSecondPicks(raw: unknown): SecondPicks {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SecondPicks = {};
  for (const tier of ['roles', 'groups'] as const) {
    const map = (raw as Record<string, unknown>)[tier];
    if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
    for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
      if (!isTwoPick(attireRow(tier, key))) continue;
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const v = value as Record<string, unknown>;
      const pick: SecondPick = {};
      if ('style' in v && (v.style === null || isAttireStyle(v.style))) pick.style = v.style as AttireStyle | null;
      if (Array.isArray(v.colours)) {
        const colours = v.colours.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, secondPickColoursMax(key));
        if (colours.length > 0) pick.colours = colours;
      }
      if (!('style' in pick) && !pick.colours) continue;
      (out[tier] ??= {})[key] = pick;
    }
  }
  return out;
}

type Config = Record<string, unknown> | null | undefined;

/** The row's FIRST Wear, as stored (the shipped place). */
export function firstStyleOf(config: Config, tier: AttireTier, key: string): AttireStyle | null {
  const rule = ((config?.[tier] ?? {}) as Record<string, { style?: unknown }>)[key];
  return isAttireStyle(rule?.style) ? rule.style : null;
}

/**
 * The row's picks as a reader sees them: each one's Wear (null = not said) and its own colours (null = the row's).
 *
 * 🔑 EACH COLUMN READS ONLY ITS OWN PERSON'S STYLE (owner 2026-10-16). A row saved before the split holds ONE Wear for
 * everybody — cale-ice's sponsors hold "Long gown" — and that one Wear is read per column:
 *   · the person it fits keeps it (the women keep "Long gown");
 *   · the other reads "Not said yet" (the men) — never the nearest men's style. "Long gown" said nothing about the
 *     men, and a style is never assumed for anyone (2026-09-20, `role-dress-code.ts`: "There is no default"); the old
 *     drawing table's "a man's Long gown is a suit" was a drawing fallback, not the couple's word.
 * An `either` row's one person is whoever wears its style (a reader in a gown is drawn a woman).
 */
/** `designs` — set only by `picksWithDesigns` (lib/attire-design-picks.ts): the column's allowed styles and designs. */
export type ReadPick = { who: FigureWho; style: AttireStyle | null; colours: string[] | null; role: FigureRole | null; designs?: string[] };
export function picksOf(config: Config, row: AttireRowDef): ReadPick[] {
  const first = firstStyleOf(config, row.tier, row.key);
  /* 👔 A row with its own designs reads a stored Wear INTO the column's role (`designOf`: its own design, or an old word
     with one meaning — `formal`, a boy's `suit`); anything else is "Not said yet". */
  const own = (index: 0 | 1, style: AttireStyle | null): AttireStyle | null => {
    const role = columnRole(row.key, index);
    if (role) return designOf(role, style);
    return style && pickOptions(row, index).includes(style) ? style : null;
  };
  if (row.who.length === 1) {
    const style = own(0, first);
    const who = row.either && style && !fitsWho(row.who[0], style) ? COUNTERPART[row.who[0]] : row.who[0];
    return [{ who, style, colours: null, role: columnRole(row.key, 0) }];
  }
  const second = sanitizeSecondPicks(config?.women)[row.tier]?.[row.key];
  /* 🤵‍♂️ An `optionalSecond` column never reads the first column's Wear (the maid's gown said nothing about a man). */
  const inherited = row.optionalSecond ? null : first;
  return [
    { who: row.who[0], style: own(0, first), colours: null, role: columnRole(row.key, 0) },
    { who: row.who[1]!, style: own(1, second && 'style' in second ? (second.style ?? null) : inherited), colours: second?.colours ?? null, role: columnRole(row.key, 1) },
  ];
}

/** A row's Wear in one line, as the Studio says it — "For men: Suit and tie · For women: Long gown", or "Not said yet". */
export function wearSaid(config: Config, row: AttireRowDef): string {
  const picks = picksOf(config, row);
  const two = picks.length === 2;
  return picks.map((p) => `${two ? `${PICK_LABEL[p.who]}: ` : ''}${p.style ? designLabel(p.role, p.style) : 'Not said yet'}`).join(' · ');
}

const womenOf = (config: Record<string, unknown>): SecondPicks => sanitizeSecondPicks(config.women);
function withSecond<C extends Record<string, unknown>>(config: C, tier: AttireTier, key: string, change: (pick: SecondPick) => SecondPick): C {
  const women = womenOf(config);
  const map = { ...(women[tier] ?? {}) };
  const next = change({ ...(map[key] ?? {}) });
  if (!('style' in next) && !next.colours) delete map[key];
  else map[key] = next;
  const out: SecondPicks = { ...women, [tier]: map };
  if (Object.keys(map).length === 0) delete out[tier];
  return { ...config, women: out };
}

/**
 * The FIRST pick's Wear (men · boys, or the row's only one) — written where it has always been written
 * (`withAttireStyle`, passed in so this file stays free of the Studio's writer). On a two-pick row whose women's Wear
 * still follows the shared one, the women's is pinned to it first.
 */
export function withFirstStyle<C extends Record<string, unknown>>(
  config: C,
  tier: AttireTier,
  key: string,
  style: string | null,
  write: (config: C, tier: AttireTier, key: string, style: string | null) => C,
): C {
  const row = attireRow(tier, key);
  let base = config;
  /* An `optionalSecond` column never followed the first, so there is nothing to pin. */
  if (row && isTwoPick(row) && !row.optionalSecond) {
    const second = womenOf(config)[tier]?.[key];
    /* Pinned to what the women READ — the shared Wear when it is theirs, else "Not said yet" (`picksOf`). */
    if (!(second && 'style' in second)) base = withSecond(base, tier, key, (p) => ({ ...p, style: picksOf(config, row)[1]!.style }));
  }
  return write(base, tier, key, style);
}

/** The SECOND pick's Wear (women · girls) — `null` is said ("Not said yet"), never "follow the men". */
export function withSecondStyle<C extends Record<string, unknown>>(config: C, tier: AttireTier, key: string, style: AttireStyle | null): C {
  return withSecond(config, tier, key, (p) => ({ ...p, style }));
}

/** The SECOND pick's own colours — `null` hands them back to the row's. */
export function withSecondColours<C extends Record<string, unknown>>(config: C, tier: AttireTier, key: string, colours: readonly string[] | null): C {
  return withSecond(config, tier, key, (p) => {
    const { colours: _was, ...rest } = p;
    const keep = (colours ?? []).filter((c) => HEX.test(c)).slice(0, secondPickColoursMax(key));
    return keep.length > 0 ? { ...rest, colours: keep } : rest;
  });
}

/* ── who is reading ─────────────────────────────────────────────────────── */

/** A guest row's `attire` (gown · suit · neutral), or null for anything else — an older read carries none. */
export function guestAttireOf(guest: { attire?: unknown } | null | undefined): GuestAttire | null {
  const a = guest?.attire;
  return a === 'gown' || a === 'suit' || a === 'neutral' ? a : null;
}

/**
 * 👤 A guest row's own name parts AND gender, for every "you" panel (Welcome, Me, the Dress code scene) — ONE builder,
 * so no surface hands the dress code a title without the "Atty. (Woman)" pick beside it (owner 2026-10-19: an
 * "Atty. (Woman)" mother of the groom read "Parent of the Groom" and both columns on her Me page).
 */
export function guestNamePartsOf(guest: { name_prefix?: string | null; display_name?: string | null; gender?: unknown }): GuestNameParts {
  const g = guest.gender;
  return { name_prefix: guest.name_prefix ?? null, display_name: guest.display_name ?? null, gender: g === 'woman' || g === 'man' ? g : null };
}

/** Roles that say who the reader is, on their own. */
const ROLE_WHO: Partial<Record<GuestRole, FigureWho>> = {
  principal_sponsor_ninang: 'f',
  principal_sponsor_ninong: 'm',
  /* 👯 Every honour role says who they are — each reads their own column of their honour row. */
  maid_of_honor: 'f',
  matron_of_honor: 'f',
  man_of_honor: 'm',
  best_man: 'm',
  best_woman: 'f',
  flower_girl: 'girl',
  ring_bearer: 'boy',
  bible_bearer: 'boy',
  coin_bearer: 'boy',
};

/**
 * 👤 WHO ONE READER IS, as their own guest row says it — the "Atty. (Woman)" pick (`guests.gender`) and their title.
 * The KEY is required on purpose: a caller that has no row says so with `null`, and one that forgets cannot compile —
 * the Me page read a woman parent's two columns for weeks because the gender never reached here (2026-10-19).
 */
/** 👤 A reader's own name parts and gender, as the guest page hands them to the dress code (`DressCodeWidget`). */
export type GuestNameParts = { name_prefix?: string | null; display_name?: string | null; gender: string | null | undefined };

export type ReaderPerson = { gender: string | null | undefined; name_prefix?: string | null; display_name?: string | null } | null;

/**
 * Which of a two-pick row's people THIS guest is — or null (unknown: they are shown both). A role that says it (ninang,
 * ninong, the flower girl, the bearers) answers first; else THE PERSON, by the one per-person reading
 * (`womanOrManOf`, lib/guest-title.ts): the "Atty. (Woman)" pick → a title that says it → the couple's "what they
 * wear" on the guest list (`guests.attire`, gown · suit), read for the row's two people (a woman is the women's or
 * the girls' pick).
 */
export function readerPick(
  row: AttireRowDef,
  role: GuestRole | null | undefined,
  attire: GuestAttire | null | undefined,
  person: ReaderPerson = null,
): 0 | 1 | null {
  if (row.who.length !== 2) return 0;
  const said = role ? ROLE_WHO[role] : undefined;
  const feminine = said ? said === 'f' || said === 'girl' : womanOfReader(attire, person);
  if (feminine === null) return null;
  /* By WHO each column dresses, never by position: the maid's row is women first (2026-10-19), every other men first. */
  const at = row.who.findIndex((w) => (w === 'f' || w === 'girl') === feminine);
  return at < 0 ? null : (at as 0 | 1);
}

/** true · false · null (unknown) — the reader is a woman, by `womanOrManOf`: gender → title → attire. */
function womanOfReader(attire: GuestAttire | null | undefined, person: ReaderPerson): boolean | null {
  const said = womanOrManOf({ ...(person ?? { gender: null }), attire: attire ?? null });
  return said === 'woman' ? true : said === 'man' ? false : null;
}

/* ── what ONE reader is told ────────────────────────────────────────────── */

const CHILD_ROLE: Partial<Record<GuestRole, FigureWho>> = { flower_girl: 'girl', ring_bearer: 'boy', bible_bearer: 'boy', coin_bearer: 'boy' };

/**
 * The reader's own Wear, colours and people (the dress code's "You are …" panel and Me › What to wear).
 *   · their answer came from a TWO-PICK group (a ninong reading "Principal Sponsors"): their own pick — or, when the
 *     page cannot tell which they are, BOTH, each named ("For men: Barong Tagalog · For women: Filipiniana");
 *   · otherwise the one answer, worn by the role's own person (a ninang a woman, a ring bearer a boy; a role that
 *     holds both, by the couple's own gown / suit for this guest — else both).
 */
export function readerAttire(input: {
  role: GuestRole | null | undefined;
  attire: GuestAttire | null | undefined;
  /** 👤 The reader's own row — gender and title (`ReaderPerson`). Required: `null` when the caller has no row. */
  person: ReaderPerson;
  source: 'role' | 'group' | null;
  config: Config;
  /** The resolved answer's Wear and colours (`resolveGuestAttireWithGroups`). */
  style: AttireStyle | null;
  hexes: readonly string[];
  /** How a style is said (`ATTIRE_STYLE_LABEL`) — handed in, so this file holds no copy of its own. */
  label: (style: AttireStyle) => string;
  /** The role's single person by the shipped figure rule (`roleFigures`' gown / suit), or null for a role that holds both. */
  single: (role: GuestRole) => 'gown' | 'suit' | null;
}): { styleLabel: string | null; hexes: string[]; picks: Array<{ who: FigureWho; style: AttireStyle | null; colours: string[] | null; role: FigureRole | null }> } {
  const { role, attire, config, style, hexes, label } = input;
  /* 👔 Said in the person's OWN words for the design ("Filipiniana (terno)" for a bride) where they have a list. */
  const say = (p: { style: AttireStyle | null; role?: FigureRole | null }) => (p.style ? (p.role ? designLabel(p.role, p.style) : label(p.style)) : null);
  /* 🪞 The reader's Studio row (`studioRowOf`, 2026-10-17) — whether or not the row's FIRST pick is stored: a ninang
     whose couple picked only the women's Wear still reads it. */
  const studioRow = studioRowOf(role, config ?? null);
  const groupRow = studioRow && studioRow.tier === 'groups' ? studioRow : null;
  /* 👯 A two-pick row the reader is dressed by — a group's, or the honour row "Best Man & Best Woman" (2026-10-19). */
  const pairRow = studioRow && isTwoPick(studioRow) && (groupRow || isHonourRole(role)) ? studioRow : null;
  if (pairRow) {
    const picks = picksOf(config, pairRow).map((p) => ({ ...p, colours: p.colours ?? [...hexes] }));
    const r = readerPick(pairRow, role, attire, input.person);
    if (r !== null) {
      const one = picks[r]!;
      return { styleLabel: say(one), hexes: one.colours, picks: [one] };
    }
    return { styleLabel: bothSaid(picks, say), hexes: [...hexes], picks };
  }
  const kind = role ? input.single(role) : null;
  const woman = womanOfReader(attire, input.person);
  const who: FigureWho[] = role && CHILD_ROLE[role] ? [CHILD_ROLE[role]!] : kind === 'gown' ? ['f'] : kind === 'suit' ? ['m'] : woman === true ? ['f'] : woman === false ? ['m'] : ['f', 'm'];
  /* Each person keeps the one answer only where it is theirs — a father is never told "Long gown". A person with their
     own drawings (a best man, a ninang) reads it into THEIR design (`designOf`); a best man whose groomsmen wear a vest
     and tie (a design a best man has no drawing of) is drawn as the groomsmen are — the row's own role. */
  const rowRole = groupRow ? columnRole(groupRow.key, 0) : null;
  const picks = who.map((w) => {
    const mine = readerFigureRole(role, w);
    if (mine) {
      const own = designOf(mine, style);
      if (own) return { who: w, style: own, colours: [...hexes], role: mine };
      const theirs = rowRole && rowRole !== mine ? designOf(rowRole, style) : null;
      if (theirs && groupRow?.who[0] === w) return { who: w, style: theirs, colours: [...hexes], role: rowRole };
      return { who: w, style: null, colours: [...hexes], role: mine };
    }
    return { who: w, style: fitsWho(w, style) ? style : null, colours: [...hexes], role: null };
  });
  return { styleLabel: picks.length === 1 ? say(picks[0]!) : bothSaid(picks, say), hexes: [...hexes], picks };
}

/** Two people's Wear in one line: one design when they agree, else each named ("For men: Suit and tie · For women: Long gown"). */
export function bothSaid<P extends { who: FigureWho; style: AttireStyle | null; role?: FigureRole | null }>(picks: readonly P[], say: (p: P) => string | null): string | null {
  const [a, b] = picks as unknown as [P, P];
  const sa = say(a);
  const sb = say(b);
  return sa === sb ? sa : sa || sb ? `${PICK_LABEL[a.who]}: ${sa ?? 'not said yet'} · ${PICK_LABEL[b.who]}: ${sb ?? 'not said yet'}` : null;
}

/**
 * 🔁 A WRITER THAT REBUILDS THE WHOLE DRESS CODE KEEPS THE SECOND PICKS. `updateDressCode` (the older dress-code form)
 * builds every part from its fields — and has no field for the women's picks — so the stored ones are carried over
 * from what it is about to replace. Without this, a save from that form would silently take every women's Wear away.
 */
export function withSecondPicksCarried<C extends Record<string, unknown>>(next: C, base: unknown): C & { women?: SecondPicks } {
  const was = sanitizeSecondPicks(base && typeof base === 'object' ? (base as Record<string, unknown>).women : null);
  return Object.keys(was).length > 0 ? { ...next, women: was } : next;
}
