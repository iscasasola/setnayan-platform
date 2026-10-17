/**
 * lib/dress-code-for-everyone.ts — the GENERAL view of the Event Hub's Dress
 * code scene, and the one rule for when a reader's own answer stands down.
 *
 * ⛔ A SEPARATE FILE FROM `role-group-dress-code.ts`, DELIBERATELY: that module is imported by the dress-code
 * editor's CLIENT components. Since 2026-10-17 the general view reads the Studio's own rows and people
 * (`ATTIRE_ROWS`, `picksOf`) — see "ONE FACT, READ ONCE" below.
 *
 * Pure. No I/O.
 */
import { ATTIRE_STYLE_LABEL, type AttireStyle, type resolveGuestDressCode } from './role-dress-code';
import { designLabel, type FigureRole } from './attire-designs';
import { ATTIRE_ROWS, PICK_LABEL, picksOf, type AttireTier } from './attire-rows';
import type { FigureWho } from './attire-figures';
import { pickDots } from './role-figure';
import { roleLabel } from './entourage';
import { guestRoleLabel, ROLE_LABELS, type GuestRole } from './guests';
import { roleNameMany, type RoleNames } from './role-names';
import { PALETTE_LIMITS, type PaletteKey, type RolePalette } from './mood-board';

/* ══════════════════════════════════════════════════════════════════════════
   EVERYONE'S DRESS CODE — the general view of the Event Hub's Dress code scene
   ══════════════════════════════════════════════════════════════════════════

   Owner, 2026-09-28: *"if in general, show our theme and the palettes of each role. but if there is an account
   specified to this, show their palette only."* — and, 2026-10-17, on his own live page: *"the website does not
   reflect what is picked on attires on mood board & dress code"* and *"if on moodboard&dress code, nothing is picked,
   then nothing should show."*

   🔑 ONE FACT, READ ONCE (2026-10-17). The scene used to build its rows from the Mood Board's palette KEYS
   (`PALETTE_ORDER`) and its words from a per-role precedence of its own — so it drew rows the editor has no row for
   (Maid / Matron of Honor, Best Man / Best Woman, Wedding Party), a per-role "Long gown" for a mixed pair of parents,
   and every heading whether or not anything was picked under it. Studio › Mood Board & Dress Code draws its Attire
   from `ATTIRE_ROWS` and each row's people from `picksOf` (`lib/attire-rows.ts`). This reads THE SAME TWO, so the
   page and the editor cannot disagree about a row, a person, a Wear or a colour:
     · the rows — `ATTIRE_ROWS`, in its (the Studio's) order;
     · each row's people — `picksOf`: the Wear each column reads (an old word read into the person's own design, a
       Wear that is not theirs "Not said yet"), and the women's / girls' own colours;
     · each person's colours — the board the Studio shows (`board` = `resolveDisplayPalette(stored)`), and every
       colour said by what it colours (`pickDots`, the Studio's own words).
   ⛔ NOTHING PICKED, NOTHING SHOWN. A person shows when their Wear is picked or the couple picked the row's colours
   (a key in `touched_roles`); a row shows when one of its people does. Never a bare heading, never a default.
   ⚠ What the Studio has no row for is not drawn: the old per-role lines (`dress_code_config.roles` for anyone but the
   bride, the groom, the celebrant and the guests), the old palette keys (`maid_of_honor`, `best_man`, `wedding_party`)
   and couple-named roles. Nothing is deleted — the stored values stay where they are. */

/** One line of instruction under a row: "For men · Suit and tie" (a two-pick row) or the row's own Wear. */
export type EveryoneAttireLine = {
  /** The person's label on a row of two ("For men"), else the row's label. */
  label: string;
  styleLabel: string;
  note: string | null;
  source: 'role' | 'group';
};

/** One colour, and the word for what it colours (`pickDots`). */
export type EveryoneDot = { hex: string; word: string };

/** One person of a row, as the guest reads them. */
export type EveryonePick = {
  who: FigureWho;
  /** "For men" on a row of two; null on a row of one. */
  label: string | null;
  style: AttireStyle | null;
  /** The Wear in the person's own word ("Filipiniana (terno)"), or null when not picked. */
  styleLabel: string | null;
  role: FigureRole | null;
  /** The colours the person wears (the figure's), in dot order. */
  colours: string[];
  dots: EveryoneDot[];
};

export type EveryoneDressRow = {
  /** The Mood Board palette key the row is coloured by (the row key when it has none — the celebrant). */
  key: string;
  /** The Studio row (`ATTIRE_ROWS`). */
  tier: AttireTier;
  rowKey: string;
  label: string;
  meaning: 'outfit' | 'options';
  picks: EveryonePick[];
  /** The couple's note for the row. */
  note: string | null;
  /** Every dot of every person, in order — for the layouts that draw the colours apart from the people. */
  hexes: string[];
  lines: EveryoneAttireLine[];
};

export type EveryoneDressCode = {
  /** The Mood Board's main colours (the `reception` key — "your main colours"). */
  ourColours: string[];
  rows: EveryoneDressRow[];
};

/*
 * The Mood Board's own words for each palette, with two swapped for words a
 * guest already reads elsewhere: `PALETTE_LIMITS.guest.label` is "Plain
 * guests" — editor language — so on the Event Hub that row reads as the guest
 * list's own "Guest". Both strings already ship; neither is new copy.
 */
function rowLabel(key: PaletteKey, names?: RoleNames | null): string {
  if (key === 'guest') return ROLE_LABELS.guest;
  // ⚖ Owner 2026-09-30: a row named after a role the couple renamed reads
  // THEIR word ("Bride's Crew", not "Bridesmaids").
  const role = PALETTE_NAMED_AFTER[key];
  return (role ? roleNameMany(role, names) : null) ?? PALETTE_LIMITS[key].label;
}

/** The palette rows whose heading IS a role's word — see `rowLabel`. */
const PALETTE_NAMED_AFTER: Partial<Record<PaletteKey, GuestRole>> = {
  bridesmaids: 'bridesmaid',
  groomsmen: 'groomsman',
};

const noteOf = (config: Record<string, unknown> | null, tier: AttireTier, key: string): string | null => {
  const rule = ((config?.[tier] ?? {}) as Record<string, { note?: unknown } | undefined>)[key];
  const note = typeof rule?.note === 'string' ? rule.note.trim().slice(0, 120) : '';
  return note || null;
};

/**
 * The general view: our colours, then every Studio row with something picked, in the Studio's order.
 * See the block above for why it reads `ATTIRE_ROWS` + `picksOf` and nothing else.
 */
export function dressCodeForEveryone(input: {
  /** `events.dress_code_config`, as stored (read through `picksOf` — the Studio's reader). */
  config: unknown;
  stored: RolePalette;
  board: RolePalette;
  ceremonyType?: string | null;
  /** The couple's words for roles (owner 2026-09-30). */
  names?: RoleNames | null;
}): EveryoneDressCode {
  const { stored, board } = input;
  const config = input.config && typeof input.config === 'object' && !Array.isArray(input.config) ? (input.config as Record<string, unknown>) : null;
  const touched = new Set<string>(stored.touched_roles ?? []);
  /** The colours the Studio shows for a row (the board), and whether the couple PICKED them (touched / stored). */
  const shown = (key: PaletteKey): string[] => {
    const c = board[key];
    return Array.isArray(c) ? c.filter((h) => typeof h === 'string' && h.length > 0) : [];
  };
  const picked = (key: PaletteKey): boolean => (touched.has(key) || (stored[key]?.length ?? 0) > 0) && shown(key).length > 0;

  const rows: EveryoneDressRow[] = [];
  for (const def of ATTIRE_ROWS) {
    if (def.key === 'muslim_principals' && input.ceremonyType !== 'muslim') continue;
    const key = def.paletteKey;
    const meaning: 'outfit' | 'options' = key && PALETTE_LIMITS[key].meaning === 'options' ? 'options' : 'outfit';
    const rowColours = key ? shown(key) : [];
    const rowPicked = key ? picked(key) : false;
    const two = def.who.length === 2;
    const picks: EveryonePick[] = [];
    for (const p of picksOf(config, def)) {
      const ownColours = p.colours && p.colours.length > 0 ? [...p.colours] : null;
      if (!p.style && !ownColours && !rowPicked) continue;
      const colours = ownColours ?? rowColours;
      picks.push({
        who: p.who,
        label: two ? PICK_LABEL[p.who] : null,
        style: p.style,
        styleLabel: p.style ? (p.role ? designLabel(p.role, p.style) : ATTIRE_STYLE_LABEL[p.style]) : null,
        role: p.role,
        colours,
        dots: pickDots(p.style, colours, p.role, meaning === 'options').map((d) => ({ hex: d.hex, word: d.word })),
      });
    }
    if (picks.length === 0) continue;
    const label = key ? rowLabel(key, input.names) : (roleLabel(def.key as GuestRole, input.names) ?? guestRoleLabel(def.key as GuestRole, input.names));
    const source: 'role' | 'group' = def.tier === 'roles' ? 'role' : 'group';
    const note = noteOf(config, def.tier, def.key);
    rows.push({
      key: key ?? def.key,
      tier: def.tier,
      rowKey: def.key,
      label,
      meaning,
      picks,
      note,
      hexes: picks.flatMap((p) => p.dots.map((d) => d.hex)),
      lines: picks.filter((p) => p.styleLabel).map((p) => ({ label: p.label ?? label, styleLabel: p.styleLabel!, note: null, source })),
    });
  }
  const main = shown('reception');
  return { ourColours: (stored.reception?.length ?? 0) > 0 ? main : [], rows };
}

/**
 * WHEN THE READER'S OWN ANSWER STANDS DOWN FOR EVERYONE'S.
 *
 * Owner, 2026-09-28: *"if there is an account specified to this, show their
 * palette only"* — and, carried with it: a role-holder whose role has no
 * colours gets the general view. A panel that can say nothing but the role's
 * NAME ("You are Ninang · Outfit to be confirmed" — no colour, no outfit, no
 * time) is a name tag; every role's colours, hers included, serve her better.
 *
 * 🔑 ONLY THEN. A panel with a colour, an outfit or a call time is kept — a
 * ninang whose couple wrote "long gown, 1:00 PM" and picked no colour still
 * needs that line first. And where there is no general view to fall back to,
 * the name-tag panel stays, so the scene does not vanish for her where it
 * showed before.
 */
export function speaksToThisReader<
  T extends { panel: ReturnType<typeof resolveGuestDressCode>; source: 'role' | 'group' | null },
>(resolved: T, generalHasContent: boolean): T {
  const p = resolved.panel;
  if (!p) return resolved;
  const saysSomething = p.hexes.length > 0 || p.style !== null || p.callTime !== null;
  if (saysSomething || !generalHasContent) return resolved;
  return { ...resolved, panel: null, source: null };
}
