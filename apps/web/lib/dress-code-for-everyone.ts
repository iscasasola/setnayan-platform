/**
 * lib/dress-code-for-everyone.ts — the GENERAL view of the Event Hub's Dress
 * code scene, and the one rule for when a reader's own answer stands down.
 *
 * ⛔ A SEPARATE FILE FROM `role-group-dress-code.ts`, DELIBERATELY. That module
 * is imported by the dress-code editor's CLIENT components; this one reads the
 * Mood Board's display order (`mood-board-derive` → the OKLCH palette engine),
 * which the editor never needs and should not ship to the browser. Precedence
 * is still decided in exactly one place — `resolveAttireFor`, imported here.
 *
 * Pure. No I/O.
 */
import { ATTIRE_STYLE_LABEL, type RoleAttireMap, type resolveGuestDressCode } from './role-dress-code';
import { resolveAttireFor, type GroupAttireMap } from './role-group-dress-code';
import { ROLE_GROUP_LABELS, roleGroupOf, type RoleGroup } from './role-groups';
import { roleLabel } from './entourage';
import { ROLE_LABELS, type GuestRole } from './guests';
import {
  PALETTE_LIMITS,
  PALETTE_ORDER,
  paletteKeyForRole,
  type PaletteKey,
  type RolePalette,
} from './mood-board';
import { roleDisplayOrder } from './mood-board-derive';

/* ══════════════════════════════════════════════════════════════════════════
   EVERYONE'S DRESS CODE — the general view of the Event Hub's Dress code scene
   ══════════════════════════════════════════════════════════════════════════

   Owner, 2026-09-28, looking at the Maker's Dress code scene: *"we already have
   a palette and it adjusts real time with the event hub. if in general, show
   our theme and the palettes of each role. but if there is an account
   specified to this, show their palette only."*

   🔑 NOTHING HERE IS A NEW READ OF THE COLOURS. The caller hands in the Mood
   Board twice: `stored` (the couple's `role_palette`, sanitised) and `board`
   (`resolveDisplayPalette(stored)` — what section 02 of the Mood Board SHOWS,
   and what the 3D room dresses people in). A row's swatches are the board's,
   so the scene cannot show a bridesmaid one colour while the Mood Board and
   the room show another.

   🔑 WHICH ROLES GET A ROW: the ones the couple's own board holds (`stored`).
   The board derives a colour for EVERY role from the main colours, but the
   Mood Board only shows a role's card when a guest holds that role — a read
   this scene does not have. Listing every derivable role would print a Nikah
   Principals row on a Catholic wedding. The stored keys are the couple's own
   statement of which roles they dressed; `muslim_principals` additionally
   waits for a muslim ceremony, exactly as its PALETTE_LIMITS note says.

   🔑 THE STYLE LINES COME FROM THE SAME PRECEDENCE AS EVERY OTHER SURFACE —
   `resolveAttireFor`, above, per role. A group rule answers once, under the
   group's own name, instead of once per role it covers. */

/** One line of instruction under a role's colours: "Ninang · Long gown — in the wedding colours". */
export type EveryoneAttireLine = {
  /** "Ninang" for a role's own rule, "Principal Sponsors" for a group's. */
  label: string;
  styleLabel: string;
  note: string | null;
  source: 'role' | 'group';
};

export type EveryoneDressRow = {
  /** A PaletteKey, or `custom:<slug>` for a couple-named Mood Board role. */
  key: string;
  label: string;
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
 * guests" and `wedding_party`'s is "Wedding Party (all)" — editor language
 * that tells a fallback apart from its sub-keys. On the Event Hub those rows
 * read as the guest list's own "Guest" and the role group's own "Wedding
 * Party". Both strings already ship; neither is new copy.
 */
function rowLabel(key: PaletteKey): string {
  if (key === 'guest') return ROLE_LABELS.guest;
  if (key === 'wedding_party') return ROLE_GROUP_LABELS.wedding_party;
  return PALETTE_LIMITS[key].label;
}

/** Every role in the vocabulary, from the exhaustive `Record` (same reason as ROLE_GROUPS_IN_ORDER). */
const EVERY_GUEST_ROLE = Object.keys(ROLE_LABELS) as GuestRole[];

function linesFor(key: PaletteKey, roles: RoleAttireMap, groups: GroupAttireMap): EveryoneAttireLine[] {
  const out: EveryoneAttireLine[] = [];
  const seenGroups = new Set<RoleGroup>();
  for (const role of EVERY_GUEST_ROLE) {
    if (paletteKeyForRole(role) !== key) continue;
    // The celebrant maps to the guest palette by default, but she is not a
    // guest — her line never belongs under "Guest".
    if (key === 'guest' && roleGroupOf(role) === 'honoree') continue;
    const won = resolveAttireFor(role, roles, groups);
    if (!won) continue;
    if (won.source === 'group') {
      const g = roleGroupOf(role);
      if (g === 'guest' || seenGroups.has(g)) continue;
      seenGroups.add(g);
      out.push({
        label: ROLE_GROUP_LABELS[g],
        styleLabel: ATTIRE_STYLE_LABEL[won.rule.style],
        note: won.rule.note ?? null,
        source: 'group',
      });
      continue;
    }
    out.push({
      label: roleLabel(role) ?? ROLE_LABELS[role],
      styleLabel: ATTIRE_STYLE_LABEL[won.rule.style],
      note: won.rule.note ?? null,
      source: 'role',
    });
  }
  return out;
}

/**
 * The general view: our colours, then every role the couple dressed, in the
 * Mood Board's own order (`roleDisplayOrder`: couple → family → principal
 * sponsors → entourage → secondary sponsors & bearers → officiants), the
 * couple's own named roles after them, and guests last.
 *
 * A row with no colours still shows when the couple wrote an outfit for it —
 * an instruction that exists and is not rendered is the defect this scene has
 * already shipped once (see `dress-code-widget.tsx`, "COMPUTED BEFORE THE
 * EMPTY-STATE DECISION"). A row with neither is left out.
 */
export function dressCodeForEveryone(input: {
  stored: RolePalette;
  board: RolePalette;
  roles: RoleAttireMap;
  groups: GroupAttireMap;
  ceremonyType?: string | null;
}): EveryoneDressCode {
  const { stored, board, roles, groups } = input;
  const colours = (key: PaletteKey): string[] => {
    const own = stored[key];
    if (!Array.isArray(own) || own.length === 0) return [];
    const shown = board[key];
    return Array.isArray(shown) && shown.length > 0 ? [...shown] : [...own];
  };
  const fixed = roleDisplayOrder(
    PALETTE_ORDER.filter((k) => k !== 'ceremony' && k !== 'reception' && k !== 'guest'),
  ).filter((k) => k !== 'muslim_principals' || input.ceremonyType === 'muslim');

  const rowOf = (key: PaletteKey): EveryoneDressRow | null => {
    const hexes = colours(key);
    const lines = linesFor(key, roles, groups);
    if (hexes.length === 0 && lines.length === 0) return null;
    return { key, label: rowLabel(key), hexes, lines };
  };

  const rows: EveryoneDressRow[] = [];
  for (const key of fixed) {
    const row = rowOf(key);
    if (row) rows.push(row);
  }
  for (const custom of board.custom_roles ?? stored.custom_roles ?? []) {
    const hexes = (custom.colors ?? []).filter((h) => typeof h === 'string' && h.length > 0);
    if (hexes.length === 0 || !custom.label) continue;
    rows.push({ key: `custom:${custom.key}`, label: custom.label, hexes, lines: [] });
  }
  const guests = rowOf('guest');
  if (guests) rows.push(guests);

  return { ourColours: colours('reception'), rows };
}

/**
 * MERGE, NOT BESIDE: the couple's hand-typed `dress_code_config.palette` joins
 * the Mood Board's main colours in ONE "Our colours" row.
 *
 * Why merge: the Maker's dress-code panel SEEDS that palette from the Mood
 * Board (`paletteSwatches`, editor `page.tsx`), so a couple who saved the panel
 * once holds a frozen copy of their theme. Shown beside the live Mood Board it
 * would print the same colours twice today, and two DISAGREEING rows the day
 * they change their theme. So the Mood Board's colours lead (live), a typed
 * colour with the same hex lends it its NAME ("Sage"), and a typed colour the
 * board does not hold follows after — authored data is never dropped.
 *
 * With no Mood Board main colours this is exactly the authored palette, as it
 * rendered before.
 */
export function ourColoursWith(
  main: readonly string[],
  authored: ReadonlyArray<{ name: string; hex: string }>,
): Array<{ name: string; hex: string }> {
  const nameOf = new Map<string, string>();
  for (const a of authored) {
    const k = a.hex.toUpperCase();
    if (a.name && !nameOf.has(k)) nameOf.set(k, a.name);
  }
  const out: Array<{ name: string; hex: string }> = [];
  const seen = new Set<string>();
  for (const hex of main) {
    const k = hex.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name: nameOf.get(k) ?? '', hex });
  }
  for (const a of authored) {
    const k = a.hex.toUpperCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name: a.name, hex: a.hex });
  }
  return out;
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
