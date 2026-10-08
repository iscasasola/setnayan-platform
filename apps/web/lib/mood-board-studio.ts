/**
 * lib/mood-board-studio.ts — THE PURE CORE OF STUDIO › MOOD BOARD & DRESS CODE
 * (owner 2026-10-06, DECISION_LOG "STUDIO › MOOD BOARD & DRESS CODE, REDRAWN",
 * "AUTO PALETTE BESIDE SAVED — AND A REAL COLOUR PICKER FOR CHANGING IT BY
 * HAND"; plan `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 5).
 *
 * Every write the Studio makes to the five main colours is one of TWO pure
 * functions here, so the rules the owner set are held on the functions and not
 * on a component:
 *
 *   · `withMainColour` — the picker: ONE colour changes, the other four are
 *     written as they are shown (a board still wearing its theme's colours is
 *     written whole, with only that one changed — the controller's 2026-10-07
 *     ruling), and NOTHING else on the board moves;
 *   · `withAutoPalette` — ✨ Auto: the five are replaced, and nothing the couple
 *     set by hand anywhere else is touched (a part's own colour, a role's own
 *     colours). "Manual always wins: Auto never locks anything" — Auto adds no
 *     marker, so the very next pick by hand simply wins.
 *
 * 🛑 NEITHER IS DRAFTED, AND THE TEST SAYS WHY. The hub draft's `role_palette`
 * accepts ONLY a theme's own seed (`sanitizeSeedPalette` — "the Mood Board page
 * stays the only place a couple paints their own"), so a painted palette is
 * written by the Mood Board's own shipped writer (`saveRolePalette`), as the
 * Mood Board page always has. `the-picker-sets-one-colour-and-drafts-it.test.ts`
 * fails the day the draft can hold a painted palette, so this is revisited then.
 *
 * Pure. No I/O. Client-safe: `color-space.ts` and `mood-board.ts` import nothing
 * from the server.
 */
import { oklchDistance, oklchOfHex, type Oklch } from './color-space';
import { applyTouch } from './mood-board-board-ops';
import { candidatesFor, harmonySuggestions, shadeSuggestions } from './palette-recommender';
import { PALETTE_LIMITS, type PaletteKey, type RolePalette } from './mood-board';

const HEX = /^#[0-9A-F]{6}$/i;

/** Each main colour's one job (owner 2026-10-05, "THE 5 MAIN COLOURS, ONE JOB EACH"). */
export const MAIN_COLOUR_JOBS = [
  'Headings and big blocks · flowers · lights',
  'Cards and sections · table linens',
  'Buttons and links · chairs',
  'Page background · walls',
  'Ornaments and dividers · ribbons and candles',
] as const;

/** How many main colours there are — `PALETTE_LIMITS.reception.max`. */
export const MAIN_COLOUR_COUNT = PALETTE_LIMITS.reception.max;

/**
 * The five main colours AS SHOWN: the couple's (`reception`), filled out from
 * `fallback` (the worn theme's own five — `themeSeedPalette`) where the board
 * has fewer. Always five, always upper-case `#RRGGBB`.
 */
export function shownMainFive(palette: RolePalette, fallback: readonly string[]): string[] {
  const own = (palette.reception ?? []).filter((h) => HEX.test(h)).map((h) => h.toUpperCase());
  const back = fallback.filter((h) => HEX.test(h)).map((h) => h.toUpperCase());
  const out: string[] = [];
  for (let i = 0; i < MAIN_COLOUR_COUNT; i++) out.push(own[i] ?? back[i] ?? own[0] ?? back[0] ?? '#E7E1D8');
  return out;
}

/** 🎨 THE PICKER: one main colour set; the five as shown written; nothing else on the board moves. */
export function withMainColour(palette: RolePalette, shown: readonly string[], index: number, hex: string): RolePalette {
  if (!HEX.test(hex) || index < 0 || index >= MAIN_COLOUR_COUNT) return palette;
  const five = [...shown].slice(0, MAIN_COLOUR_COUNT);
  five[index] = hex.toUpperCase();
  return { ...palette, reception: five };
}

/** ✨ AUTO: the five replaced; a part or role the couple set by hand keeps its own colour. */
export function withAutoPalette(palette: RolePalette, five: readonly string[]): RolePalette {
  const clean = five.filter((h) => HEX.test(h)).map((h) => h.toUpperCase()).slice(0, MAIN_COLOUR_COUNT);
  if (clean.length === 0) return palette;
  return { ...palette, reception: clean };
}

/** A part of the room set by hand (a `room_dressing` field). */
export function withPartColour(palette: RolePalette, field: keyof NonNullable<RolePalette['room_dressing']>, hex: string): RolePalette {
  if (!HEX.test(hex)) return palette;
  return { ...palette, room_dressing: { ...palette.room_dressing, [field]: hex.toUpperCase() } };
}

/** A role's own colours set (a slot palette applied, or one chip added) — touched, so the main colours never move them. */
export function withRoleColours(palette: RolePalette, key: PaletteKey, colours: readonly string[]): RolePalette {
  if (key === 'reception') return palette;
  const clean = colours.filter((h) => HEX.test(h)).map((h) => h.toUpperCase()).slice(0, PALETTE_LIMITS[key].max);
  if (clean.length === 0) return palette;
  return applyTouch({ ...palette, [key]: clean }, key);
}

/* ══ THE PALETTE IN YOUR PHOTOS — read with lib/color-space.ts ════════════ */

/** Two colours closer than this (ΔEok) are one colour for a palette. */
const SAME_COLOUR = 0.06;

/**
 * Up to `n` colours from every photo's sampled colours: near-duplicates merged
 * (the most often seen wins), then the most seen first. Empty in → empty out —
 * a slot with no photos has no palette, and says so ("Add photos to get its
 * palette"), never a guessed one.
 */
export function paletteFromPhotos(hexes: readonly string[], n: number = MAIN_COLOUR_COUNT): string[] {
  const groups: Array<{ lab: Oklch; count: number }> = [];
  for (const raw of hexes) {
    if (!HEX.test(raw)) continue;
    const lab = oklchOfHex(raw.toUpperCase());
    const near = groups.find((g) => oklchDistance(g.lab, lab) < SAME_COLOUR);
    if (near) near.count += 1;
    else groups.push({ lab, count: 1 });
  }
  return groups
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(0, n))
    .map((g) => g.lab.hex);
}

/**
 * The photo palette put into the five SLOTS by their jobs: the lightest is the
 * page (Neutral), the most colourful the buttons (Accent), the deepest the
 * headings (Dominant), then Supporting and Accent 2 from what is left. Fewer
 * than five colours in → the rest stay as `fallback` shows them.
 */
export function slotsFromPhotoPalette(colours: readonly string[], fallback: readonly string[]): string[] {
  const pool = colours.filter((h) => HEX.test(h)).map((h) => oklchOfHex(h.toUpperCase()));
  const out = shownMainFive({}, fallback);
  if (pool.length === 0) return out;
  const take = (pick: (a: Oklch, b: Oklch) => number): Oklch | undefined => {
    if (pool.length === 0) return undefined;
    pool.sort(pick);
    return pool.shift();
  };
  const neutral = take((a, b) => b.L - a.L);
  const accent = take((a, b) => b.C - a.C);
  const dominant = take((a, b) => a.L - b.L);
  const supporting = take((a, b) => b.L - a.L);
  const accent2 = take((a, b) => b.C - a.C);
  if (dominant) out[0] = dominant.hex;
  if (supporting) out[1] = supporting.hex;
  if (accent) out[2] = accent.hex;
  if (neutral) out[3] = neutral.hex;
  if (accent2) out[4] = accent2.hex;
  return out;
}

/** "Matches my colours": a photo whose sampled colours sit near any of the five. */
export function photoMatchesColours(swatches: readonly string[], five: readonly string[], within: number = 0.12): boolean {
  const mine = five.filter((h) => HEX.test(h)).map((h) => oklchOfHex(h));
  if (mine.length === 0) return true;
  return swatches.some((s) => HEX.test(s) && mine.some((m) => oklchDistance(m, oklchOfHex(s)) < within));
}

/* ══ ✨ AUTO — suggestions ═════════════════════════════════════════════════ */

export type AutoSuggestion = { name: string; five: string[]; best?: true };

/**
 * ✨ Auto's list: the photos' own palette first (best match) when there are
 * photos, then the SHIPPED themes' own five colours (`themeSeedPalette`),
 * named as the theme is. Nothing here is a colour nobody chose: a theme's five
 * are the colours that theme already wears.
 */
export function autoSuggestions(
  photoFive: readonly string[] | null,
  themes: ReadonlyArray<{ name: string; five: readonly string[] }>,
): AutoSuggestion[] {
  const out: AutoSuggestion[] = [];
  if (photoFive && photoFive.length > 0) out.push({ name: 'From your photos', five: [...photoFive], best: true });
  for (const t of themes) out.push({ name: t.name, five: [...t.five] });
  return out;
}

/** "✨ Make more": the next `size` themes after the ones shown, wrapping. The photos' row always stays first. */
export function nextAutoPage(all: readonly AutoSuggestion[], page: number, size: number = 4): AutoSuggestion[] {
  const best = all.filter((s) => s.best);
  const rest = all.filter((s) => !s.best);
  if (rest.length === 0) return best;
  const start = (page * size) % rest.length;
  const shown: AutoSuggestion[] = [];
  for (let i = 0; i < Math.min(size, rest.length); i++) shown.push(rest[(start + i) % rest.length]!);
  return [...best, ...shown];
}

/* ══ THE PICKER'S SWATCHES ═════════════════════════════════════════════════ */

/**
 * The picker's sixteen (owner 2026-10-06: "Swatches (16 curated)") — the
 * prototype's own sixteen, a ladder of the house's plums, golds, sages, blushes
 * and creams. Display choices only: nothing is written until one is tapped.
 */
export const PICKER_SWATCHES = [
  '#5B4A6B', '#6E5A80', '#3E3350', '#2A3A5E', '#2C2A29', '#B5543A', '#A9834B', '#C9A86A',
  '#F1C27D', '#7A8B6F', '#B9C9B0', '#D9C4CF', '#E9C9D3', '#F3DDE3', '#F7F2EC', '#FFFFFF',
] as const;

/** A typed colour code ("c9a86a", "#C9A86A") as `#RRGGBB`, or null. */
export function cleanHexInput(raw: string): string | null {
  const v = raw.trim().replace(/^#?/, '#').toUpperCase();
  return HEX.test(v) ? v : null;
}

/**
 * 🎨 THE PICKER'S SUGGESTIONS, IN THE OWNER'S ORDER (2026-10-08, verbatim *"the color suggestions
 * should rely on the moodboard as well. so the mood board colors, then the complementing colors for
 * them"*): the Mood Board's five first, then the colours that go with them — the Mood Board's OWN
 * harmony (`candidatesFor`, lib/palette-recommender.ts: complement · split · analogous · triadic ·
 * lighter · deeper · muted · richer off every one of the five, kept only where it reads apart from
 * ALL five) — never a second harmony. Each list deduplicated, upper-case `#RRGGBB`; the photos,
 * swatches and Custom follow in the sheet. Display only: nothing is written until one is tapped.
 */
export function pickerSuggestions(palette: readonly string[], max = 8): { palette: string[]; goesWith: string[] } {
  const five = [...new Set(palette.map((c) => cleanHexInput(c)).filter((c): c is string => c !== null))].slice(0, 5);
  if (five.length === 0) return { palette: [], goesWith: [] };
  /* Each of the five's own candidates (its harmony first), kept only where it reads apart from all
     five — `candidatesFor` with that colour leading — then taken in turn, one from each colour, so the
     row answers the whole palette and not only its first colour. */
  const per = five.map((c, i) => {
    const own = new Set([...harmonySuggestions(c), ...shadeSuggestions(c)].map((x) => x.hex.toUpperCase()));
    const lead = [c, ...five.slice(0, i), ...five.slice(i + 1)];
    return candidatesFor(lead)
      .map((x) => cleanHexInput(x.hex))
      .filter((h): h is string => h !== null && own.has(h));
  });
  const seen = new Set(five);
  const goesWith: string[] = [];
  for (let round = 0; goesWith.length < max && per.some((l) => l.length > round); round++) {
    for (const list of per) {
      const hex = list[round];
      if (!hex || seen.has(hex)) continue;
      seen.add(hex);
      goesWith.push(hex);
      if (goesWith.length >= max) break;
    }
  }
  return { palette: five, goesWith };
}

/* ══ ATTIRE — Wear ▾ ═══════════════════════════════════════════════════════ */

/**
 * One role's outfit set (or cleared — "Not said yet") in a dress code, the rest
 * kept exactly. `tier` is where the shipped dress code keeps it: a ROLE's own
 * line (`roles` — bride, groom, guest, celebrant) or a GROUP's (`groups` —
 * sponsors, entourage…). A role line beats its group's (`resolveAttireFor`);
 * this never touches the other tier. No style is ever defaulted (owner
 * 2026-09-20: "no default outfit") — `null` removes the line.
 */
export function withAttireStyle<C extends { roles?: unknown; groups?: unknown }>(
  config: C,
  tier: 'roles' | 'groups',
  key: string,
  style: string | null,
): C {
  const map = { ...((config[tier] as Record<string, Record<string, unknown>> | undefined) ?? {}) };
  if (style === null) delete map[key];
  else map[key] = { ...(map[key] ?? {}), style };
  return { ...config, [tier]: map };
}
