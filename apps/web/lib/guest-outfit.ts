/**
 * lib/guest-outfit.ts — 👗 WHAT ONE GUEST WEARS, FROM THEIR ROLE'S DRESS CODE — ONE READING.
 *
 * Owner, verbatim, 2026-10-20, on the guest card's Seat fold ("Attire · 3D seat plan — Neutral / auto", a dropdown):
 * *"the attire depends on the dress code of their role."* So the card stopped offering its own attire pick, and the
 * 3D seat plan stopped reading `guests.attire`. Both now read THIS — the same reading the guest's own Me › What to wear
 * makes (`guestMeFacts` calls it):
 *
 *   1. the answer for their role — `resolveGuestAttireWithGroups` (the Studio row the role is dressed by: its own row
 *      for the bride, the groom, the celebrant; an honour row once its Wear is picked; else the group's row);
 *   2. THEIR OWN column of it — `readerAttire` (a ninang the women's pick, a ninong the men's; a parent by the
 *      "Atty. (Woman)" pick → their title → the stored `guests.attire`, `womanOrManOf`; unknown → both);
 *   3. a PLAIN guest (role `guest`, who has no "You are …" panel) — the Studio's own "Guests" row (`picksOf`), their
 *      column by the same `readerPick`. It is the row a plain guest reads on the Event Hub's dress code.
 *
 * Then two sayings of the one answer:
 *   · `guestOutfitWords` — the card's read-only line: "Long gown" · "from VIP · Immediate Family’s dress code", or
 *     "Not set yet" · "Set it in Studio › Mood Board & Dress Code" (plain words, never a link: no go-edit-elsewhere);
 *   · `seatPlanOutfitOf` — the 3D seat plan's figure: the garment class (gown · suit · neutral) and, when a Wear is
 *     said, the kit garment it is (a barong, a Filipiniana, a gown, a suit).
 *
 * 🔑 `guests.attire` IS NOT READ HERE except as `womanOrManOf`'s last-resort woman-or-man (unchanged). The column and
 * its data stay as they are — no migration, no rewrite.
 *
 * Pure, client-safe. No I/O.
 */
import {
  attireRow,
  bothSaid,
  guestAttireOf,
  isDressableRole,
  picksOf,
  readerAttire,
  readerPick,
  shownColumns,
  studioRowOf,
  type ReadPick,
  type ReaderPerson,
} from './attire-rows';
import { designLabel } from './attire-designs';
import type { FigureWho } from './attire-figures';
import { resolveGuestAttire, type GuestAttire, type GuestRole } from './guests';
import { womanOrManOf } from './guest-title';
import type { RolePalette } from './mood-board';
import { ATTIRE_STYLE_LABEL, sanitizeRoleAttire, type AttireStyle } from './role-dress-code';
import { singleWearerOf } from './role-figure';
import { resolveGuestAttireWithGroups, sanitizeGroupAttire } from './role-group-dress-code';
import type { RoleNames } from './role-names';
import { studioRowLabel } from './studio-attire-rows';

/** The reader's own row: name parts, the "Atty. (Woman)" pick and the stored `guests.attire` (the last-resort woman-or-man). */
export type GuestOutfitPerson = NonNullable<ReaderPerson> & { attire?: unknown };

export type GuestOutfit = {
  /** The role's answer (`resolveGuestDressCode`'s panel) — null for a plain guest and for a role with nothing to say. */
  panel: ReturnType<typeof resolveGuestAttireWithGroups>['panel'];
  source: 'role' | 'group' | null;
  /** THEIR picks: one when the page can tell who they are, both (each named) when it cannot. */
  picks: ReadPick[];
  /** Their Wear in words ("Long gown", "For men: Barong Tagalog · For women: Filipiniana") — null when nothing is said. */
  styleLabel: string | null;
  /** Their colours (`readerAttire`'s) — null for a plain guest, whose colours this reading does not take (the guests'
   *  colours are options, each its own outfit; the card and the room need only the garment). */
  hexes: string[] | null;
  /** The Studio row it came from, in the Studio's own words ("VIP · Immediate Family") — null for a role with no row. */
  rowLabel: string | null;
};

export function guestOutfitOf(input: {
  role: GuestRole | null | undefined;
  dressCodeConfig: unknown;
  /** The board the dress code reads (`resolveDisplayPalette(sanitizeRolePalette(…))`). */
  palette: RolePalette | null | undefined;
  roleNames?: RoleNames | null;
  person?: GuestOutfitPerson | null;
}): GuestOutfit {
  const role = input.role ?? null;
  const config = (input.dressCodeConfig && typeof input.dressCodeConfig === 'object' && !Array.isArray(input.dressCodeConfig)
    ? input.dressCodeConfig
    : {}) as Record<string, unknown>;
  const person = input.person ?? null;
  const attire = guestAttireOf(person);
  const studioRow = studioRowOf(role, config);
  const rowLabel = studioRow
    ? studioRowLabel(studioRow, input.roleNames ?? null, Boolean(studioRow.optionalSecond) && (role === 'man_of_honor' || shownColumns(config, studioRow).includes(1)))
    : null;

  /* 3 · A plain guest: the Studio's "Guests" row, their own column. */
  if (!role || role === 'guest') {
    const row = attireRow('roles', 'guest')!;
    const all = picksOf(config, row);
    const at = readerPick(row, 'guest', attire, person);
    const picks = at === null ? all : [all[at]!];
    return { panel: null, source: null, picks, styleLabel: saidOf(picks), hexes: null, rowLabel: studioRowLabel(row) };
  }

  /* 1 · The role's answer — exactly the arguments Me › What to wear has always passed. */
  const { panel, source } = resolveGuestAttireWithGroups({
    role,
    roles: sanitizeRoleAttire(config.roles, isDressableRole),
    groups: sanitizeGroupAttire(config.groups),
    palette: input.palette ?? null,
    names: input.roleNames ?? null,
    config,
    person: person ? { name_prefix: person.name_prefix ?? null, display_name: person.display_name ?? null, gender: person.gender ?? null, attire } : null,
  });
  /* 2 · Their own column of it (`readerAttire`, the reader Me, the checklist and the Dress code's "You are …" use). */
  const own = readerAttire({
    role,
    attire,
    person,
    source,
    config,
    style: panel?.style ?? null,
    hexes: panel?.hexes ?? [],
    label: (st) => ATTIRE_STYLE_LABEL[st],
    single: singleWearerOf,
  });
  return { panel, source, picks: own.picks.map((p) => ({ who: p.who, style: p.style, colours: p.colours, role: p.role ?? null })), styleLabel: own.styleLabel, hexes: own.hexes, rowLabel };
}

/** How the Studio says a pick ("Filipiniana (terno)" for a bride) — `readerAttire`'s own saying. */
function saidOf(picks: readonly ReadPick[]): string | null {
  const say = (p: ReadPick) => (p.style ? designLabel(p.role, p.style) : null);
  if (picks.length === 1) return say(picks[0]!);
  return bothSaid(picks, say);
}

/* ── the card's line ───────────────────────────────────────────────────── */

/** The Studio, named as the house names it — plain words on the card, never a link (no go-edit-elsewhere). */
export const OUTFIT_SET_IN = 'Set it in Studio › Mood Board & Dress Code';
export const OUTFIT_NOT_SET = 'Not set yet';

/** "VIP · Immediate Family" → "VIP · Immediate Family’s"; "Guests" → "Guests’"; "The bride" → "the bride’s". */
function possessive(label: string): string {
  const said = label.startsWith('The ') ? `the ${label.slice(4)}` : label;
  return said.endsWith('s') ? `${said}’` : `${said}’s`;
}

/**
 * 🪪 THE GUEST CARD'S LINE (Seat fold, "Attire · 3D seat plan"): what they wear and where it came from.
 *   said      → { wear: "Long gown", from: "from VIP · Immediate Family’s dress code" }
 *   not said  → { wear: "Not set yet", from: "Set it in Studio › Mood Board & Dress Code" }
 */
export function guestOutfitWords(o: GuestOutfit): { wear: string; from: string; said: boolean } {
  if (!o.styleLabel) return { wear: OUTFIT_NOT_SET, from: OUTFIT_SET_IN, said: false };
  return { wear: o.styleLabel, from: o.rowLabel ? `from ${possessive(o.rowLabel)} dress code` : 'from their role’s dress code', said: true };
}

/* ── the 3D seat plan's figure ─────────────────────────────────────────── */

/** The 3D kit's guest garments (`FigureSpec['outfit']` — gown · suit · barong · filipiniana; neutral is "not known"). */
export type SeatGarment = 'gown' | 'suit' | 'barong' | 'filipiniana';

const classOfWho = (who: FigureWho): 'gown' | 'suit' => (who === 'f' || who === 'girl' ? 'gown' : 'suit');

/**
 * A Wear, as the 3D kit can draw it. The kit has four guest garments, so every style lands on the nearest: a barong is
 * a barong (a woman's barong too); a Filipiniana is the Filipiniana (a girl's too); a woman's "Suit" is a suit
 * (the pantsuit); every other woman's or girl's style is a gown; every other man's or boy's a suit.
 */
export function seatGarmentOf(who: FigureWho, style: AttireStyle): SeatGarment {
  if (style === 'barong_tagalog') return 'barong';
  if (classOfWho(who) === 'gown') return style === 'filipiniana' ? 'filipiniana' : style === 'suit' ? 'suit' : 'gown';
  return 'suit';
}

/**
 * 🪑 WHAT THE 3D SEAT PLAN DRESSES THIS GUEST IN — from `guestOutfitOf`, never from `guests.attire` directly.
 *   · their one pick → that person's class, in the garment its Wear names (`said`), or — no Wear said — their plain
 *     class (`said: null`, so the room keeps its barong / Filipiniana variety for a Wear nobody picked);
 *   · both picks (the page cannot tell who they are): a role that says it (a wali, an imam — `resolveGuestAttire`'s
 *     gendered roles) picks its column; else nobody is assumed — `neutral`;
 *   · 👗 woman or man as picked with the title wins over a column that is not theirs (owner 2026-10-17: "a man standing
 *     as a bridesmaid is dressed as a man") — his class, no Wear assumed for him.
 */
export function seatPlanOutfitOf(
  o: GuestOutfit,
  role: GuestRole,
  person: GuestOutfitPerson | null | undefined,
): { attire: GuestAttire; said: SeatGarment | null } {
  /* Woman or man as SAID — the "Atty. (Woman)" pick or the title, never the stored `guests.attire`: that last resort
     already had its say inside `readerPick` (it chose the column), and it never outvotes a role that says who it is
     (a ninong is a man, whatever an old Gown pick on his row says). */
  const sex = womanOrManOf({ name_prefix: person?.name_prefix ?? null, display_name: person?.display_name ?? null, gender: person?.gender === 'woman' || person?.gender === 'man' ? person.gender : null, attire: null });
  const sexClass = sex === 'woman' ? 'gown' : sex === 'man' ? 'suit' : null;
  let pick: ReadPick | null = o.picks.length === 1 ? o.picks[0]! : null;
  if (!pick) {
    const implied = resolveGuestAttire(role, 'neutral', sex);
    pick = implied === 'neutral' ? null : o.picks.find((p) => classOfWho(p.who) === implied) ?? null;
    if (!pick) return { attire: implied, said: null };
  }
  const own = classOfWho(pick.who);
  const adult = pick.who === 'f' || pick.who === 'm';
  if (adult && sexClass && sexClass !== own) return { attire: sexClass, said: null };
  return { attire: own, said: pick.style ? seatGarmentOf(pick.who, pick.style) : null };
}
