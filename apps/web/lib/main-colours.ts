/**
 * lib/main-colours.ts — ONE OF THE FIVE MAIN COLOURS, EDITED ON ITS OWN, IN THE
 * DRAFT (owner 2026-10-06 DECISION_LOG "STUDIO › LOOK IS THE GLOBAL LOOK": *"the
 * five Mood Board colours, each with its job (Headings · Cards · Buttons ·
 * Background · Ornaments), editable here — one palette, not a copy"*; approved
 * 2026-10-07 "THE MISSING FIELDS ARE APPROVED").
 *
 * 🔑 ONE PALETTE. The five are the Mood Board's main colours —
 * `events.role_palette.reception`, by POSITION (`MAIN_SLOT`, lib/site-palette.ts:
 * 0 Headings · 1 Cards · 2 Buttons · 3 Background · 4 Ornaments). Nothing here is
 * a second store: the draft holds only WHICH slots changed and to what
 * (`main_colours`, `lib/hub-draft.ts`), and the host's canvas and Apply lay them
 * into the board as it stands (`boardWithMainColours`) — every other key of the
 * board (other roles, room dressing) kept.
 *
 * An empty or short board is the THEME's colours today (#6359: "no palette → the
 * theme fills it"), so a slot the board does not hold starts from the theme's
 * own (`themeSeedPalette`) — editing one colour never blanks the other four.
 *
 * Pure. Imports the palette rules from `lib/mood-board-palette-set.ts` (Builder
 * P's file) and never changes them.
 */
import { themeSeedPalette } from '@/lib/mood-board-palette-set';
import { isInviteThemeId, type InviteThemeId } from '@/lib/invite-themes';

export const MAIN_COLOUR_SLOTS = [0, 1, 2, 3, 4] as const;
export type MainColourSlot = (typeof MAIN_COLOUR_SLOTS)[number];

/** Each slot's job, in the owner's words (the prototype's `JOBS`). */
export const MAIN_COLOUR_JOB: Readonly<Record<MainColourSlot, string>> = {
  0: 'Headings · the names',
  1: 'Cards · panels',
  2: 'Buttons · links',
  3: 'Background · paper',
  4: 'Ornaments · borders',
};

/** What the draft holds: slot ("0"…"4") → `#RRGGBB`. */
export type MainColourDraft = Partial<Record<`${MainColourSlot}`, string>>;

const HEX = /^#[0-9a-f]{6}$/i;

/** Anything → the drafted slots, or undefined (nothing usable — dropped, never repaired). */
export function sanitizeMainColourDraft(raw: unknown): MainColourDraft | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: MainColourDraft = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(['0', '1', '2', '3', '4'] as const).includes(k as `${MainColourSlot}`)) return undefined;
    if (typeof v !== 'string' || !HEX.test(v.trim())) return undefined;
    out[k as `${MainColourSlot}`] = v.trim().toUpperCase();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function themeOf(raw: unknown): InviteThemeId {
  return isInviteThemeId(raw) ? raw : 'house';
}

/** The five colours the page wears today: the board's main colours, a missing slot from the theme. */
export function mainColoursOf(board: unknown, theme: unknown): string[] {
  const seed = themeSeedPalette(themeOf(theme)).reception;
  const list =
    board && typeof board === 'object' && !Array.isArray(board) && Array.isArray((board as { reception?: unknown }).reception)
      ? ((board as { reception: unknown[] }).reception as unknown[])
      : [];
  return MAIN_COLOUR_SLOTS.map((i) => {
    const v = list[i];
    return typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : (seed[i] ?? '#000000');
  });
}

/** The live slots as the draft compares them (`main_colours`' live value). */
export function mainColourSlotsOf(board: unknown, theme: unknown): Record<`${MainColourSlot}`, string> {
  const five = mainColoursOf(board, theme);
  return Object.fromEntries(MAIN_COLOUR_SLOTS.map((i) => [String(i), five[i]!])) as Record<`${MainColourSlot}`, string>;
}

/**
 * The board with the drafted slots laid into its main colours — every other key
 * kept. A board with fewer than five main colours is completed from the theme
 * first, so the five stay five.
 */
export function boardWithMainColours(board: unknown, draft: MainColourDraft, theme: unknown): Record<string, unknown> {
  const base = board && typeof board === 'object' && !Array.isArray(board) ? { ...(board as Record<string, unknown>) } : {};
  const five = mainColoursOf(board, theme);
  for (const [k, hex] of Object.entries(draft)) five[Number(k)] = hex!;
  const extra =
    Array.isArray(base.reception) ? (base.reception as unknown[]).slice(MAIN_COLOUR_SLOTS.length).filter((c) => typeof c === 'string' && HEX.test(c)) : [];
  return { ...base, reception: [...five, ...(extra as string[])] };
}

/** Did the draft change any slot from what is live? */
export function mainColoursChanged(live: unknown, draft: unknown): boolean {
  const d = sanitizeMainColourDraft(draft);
  if (!d) return false;
  const l = live && typeof live === 'object' ? (live as Record<string, unknown>) : {};
  return Object.entries(d).some(([k, hex]) => (typeof l[k] === 'string' ? (l[k] as string).toUpperCase() : null) !== hex);
}
