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
import type { FigureWho } from './attire-figures';
import type { GuestAttire, GuestRole } from './guests';
import type { PaletteKey } from './mood-board';
import { roleGroupOf } from './role-groups';

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
};

/**
 * Every row the Studio's Attire can draw, in the Mood Board's order (`studioAttireRows` picks the ones on the guest
 * list). A one-pick row whose people may be either (Nikah principals, officiants, the celebrant) is drawn as the
 * role's usual wearer — a build call, said in the handover.
 */
export const ATTIRE_ROWS: readonly AttireRowDef[] = [
  { tier: 'roles', key: 'celebrant', paletteKey: null, who: ['f'] },
  { tier: 'roles', key: 'bride', paletteKey: 'bride', who: ['f'] },
  { tier: 'roles', key: 'groom', paletteKey: 'groom', who: ['m'] },
  { tier: 'groups', key: 'vip_family', paletteKey: 'parents_immediate_family', who: ['m', 'f'] },
  { tier: 'groups', key: 'principal_sponsors', paletteKey: 'principal_sponsors', who: ['m', 'f'] },
  { tier: 'groups', key: 'secondary_sponsors', paletteKey: 'secondary_sponsors', who: ['m', 'f'] },
  { tier: 'groups', key: 'muslim_principals', paletteKey: 'muslim_principals', who: ['m'] },
  { tier: 'groups', key: 'bridesmaids', paletteKey: 'bridesmaids', who: ['f'] },
  { tier: 'groups', key: 'groomsmen', paletteKey: 'groomsmen', who: ['m'] },
  { tier: 'groups', key: 'bearers_flower_girl', paletteKey: 'bearers_flower_girl', who: ['boy', 'girl'] },
  { tier: 'groups', key: 'officiants', paletteKey: 'officiants', who: ['m'] },
  { tier: 'roles', key: 'guest', paletteKey: 'guest', who: ['m', 'f'] },
];

export function attireRow(tier: AttireTier, key: string): AttireRowDef | null {
  return ATTIRE_ROWS.find((r) => r.tier === tier && r.key === key) ?? null;
}
export function attireRowOfPalette(paletteKey: string): AttireRowDef | null {
  return ATTIRE_ROWS.find((r) => r.paletteKey === paletteKey) ?? null;
}
export const isTwoPick = (row: AttireRowDef | null): boolean => (row?.who.length ?? 0) === 2;

/** The block labels the couple reads above each pick. */
export const PICK_LABEL: Readonly<Record<FigureWho, string>> = { m: 'For men', f: 'For women', boy: 'For boys', girl: 'For girls' };

/* ── the second pick, stored ─────────────────────────────────────────────── */

export type SecondPick = { style?: AttireStyle | null; colours?: string[] };
export type SecondPicks = { roles?: Record<string, SecondPick>; groups?: Record<string, SecondPick> };

const HEX = /^#[0-9a-fA-F]{6}$/;
/** As many colours as a role's own palette holds (the guests' six options — `PALETTE_LIMITS.guest.max`). */
export const SECOND_PICK_COLOURS_MAX = 6;

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
        const colours = v.colours.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, SECOND_PICK_COLOURS_MAX);
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

/** The row's two picks as a reader sees them: each one's Wear (null = not said) and its own colours (null = the row's). */
export function picksOf(config: Config, row: AttireRowDef): Array<{ who: FigureWho; style: AttireStyle | null; colours: string[] | null }> {
  const first = firstStyleOf(config, row.tier, row.key);
  if (row.who.length === 1) return [{ who: row.who[0], style: first, colours: null }];
  const second = sanitizeSecondPicks(config?.women)[row.tier]?.[row.key];
  return [
    { who: row.who[0], style: first, colours: null },
    { who: row.who[1]!, style: second && 'style' in second ? (second.style ?? null) : first, colours: second?.colours ?? null },
  ];
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
  if (isTwoPick(row)) {
    const was = firstStyleOf(config, tier, key);
    const second = womenOf(config)[tier]?.[key];
    if (!(second && 'style' in second)) base = withSecond(base, tier, key, (p) => ({ ...p, style: was }));
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
    const keep = (colours ?? []).filter((c) => HEX.test(c)).slice(0, SECOND_PICK_COLOURS_MAX);
    return keep.length > 0 ? { ...rest, colours: keep } : rest;
  });
}

/* ── who is reading ─────────────────────────────────────────────────────── */

/** A guest row's `attire` (gown · suit · neutral), or null for anything else — an older read carries none. */
export function guestAttireOf(guest: { attire?: unknown } | null | undefined): GuestAttire | null {
  const a = guest?.attire;
  return a === 'gown' || a === 'suit' || a === 'neutral' ? a : null;
}

/** Roles that say who the reader is, on their own. */
const ROLE_WHO: Partial<Record<GuestRole, FigureWho>> = {
  principal_sponsor_ninang: 'f',
  principal_sponsor_ninong: 'm',
  flower_girl: 'girl',
  ring_bearer: 'boy',
  bible_bearer: 'boy',
  coin_bearer: 'boy',
};

/**
 * Which of a two-pick row's people THIS guest is — or null (unknown: they are shown both). Gender is stored nowhere
 * (`lib/guests.ts`): a role that says it (ninang, ninong, the flower girl, the bearers) answers first; else the
 * couple's own "what they wear" on the guest list (`guests.attire`, gown · suit, the 3D seat plan's), read for the
 * row's two people (a gown is the women's or the girls' pick).
 */
export function readerPick(row: AttireRowDef, role: GuestRole | null | undefined, attire: GuestAttire | null | undefined): 0 | 1 | null {
  if (row.who.length !== 2) return 0;
  const said = role ? ROLE_WHO[role] : undefined;
  const feminine = said ? said === 'f' || said === 'girl' : attire === 'gown' ? true : attire === 'suit' ? false : null;
  if (feminine === null) return null;
  return feminine ? 1 : 0;
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
  source: 'role' | 'group' | null;
  config: Config;
  /** The resolved answer's Wear and colours (`resolveGuestAttireWithGroups`). */
  style: AttireStyle | null;
  hexes: readonly string[];
  /** How a style is said (`ATTIRE_STYLE_LABEL`) — handed in, so this file holds no copy of its own. */
  label: (style: AttireStyle) => string;
  /** The role's single person by the shipped figure rule (`roleFigures`' gown / suit), or null for a role that holds both. */
  single: (role: GuestRole) => 'gown' | 'suit' | null;
}): { styleLabel: string | null; hexes: string[]; picks: Array<{ who: FigureWho; style: AttireStyle | null; colours: string[] | null }> } {
  const { role, attire, source, config, style, hexes, label } = input;
  const say = (s: AttireStyle | null) => (s ? label(s) : null);
  const group = role ? roleGroupOfRole(role) : null;
  const row = source === 'group' && group ? attireRow('groups', group) : null;
  if (row && isTwoPick(row)) {
    const picks = picksOf(config, row).map((p) => ({ ...p, colours: p.colours ?? [...hexes] }));
    const r = readerPick(row, role, attire);
    if (r !== null) {
      const one = picks[r]!;
      return { styleLabel: say(one.style), hexes: one.colours, picks: [one] };
    }
    const [a, b] = picks as [(typeof picks)[0], (typeof picks)[0]];
    const both = a.style === b.style ? say(a.style) : a.style || b.style ? `${PICK_LABEL[a.who]}: ${say(a.style) ?? 'not said yet'} · ${PICK_LABEL[b.who]}: ${say(b.style) ?? 'not said yet'}` : null;
    return { styleLabel: both, hexes: [...hexes], picks };
  }
  const kind = role ? input.single(role) : null;
  const who: FigureWho[] = role && CHILD_ROLE[role] ? [CHILD_ROLE[role]!] : kind === 'gown' ? ['f'] : kind === 'suit' ? ['m'] : attire === 'gown' ? ['f'] : attire === 'suit' ? ['m'] : ['f', 'm'];
  return { styleLabel: say(style), hexes: [...hexes], picks: who.map((w) => ({ who: w, style, colours: [...hexes] })) };
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
