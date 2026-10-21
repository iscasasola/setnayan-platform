/**
 * lib/attire-design-picks.ts — WHICH STYLES, AND WHICH OF THEIR DESIGNS, A COLUMN ALLOWS.
 *
 * Owner 2026-10-21 (DECISION_LOG "STYLE → UP TO FIVE DESIGNS"; prototype `attire_five_designs_per_style_2026-10-21.html`
 * § 3–4): the guests' Wear ▾ lists the column's styles, each with its designs (`lib/attire-library.ts`). ONE TAP ON A
 * STYLE ALLOWS ALL ITS DESIGNS; unticking a design narrows it. The first allowed design is the column's HERO (the one
 * its colour people wear in the Studio, the big one on the guest's board).
 *
 * ── THE STORED SHAPE (no migration — it is the dress code's own JSON) ──────────────────────────────────────────
 * Beside a column's `style` (`dress_code_config[tier][key].style`, the women's `dress_code_config.women[tier][key]
 * .style`), `designs: string[]`, in tick order:
 *   · `"suit"`          — the whole style: every design of it, drawn now or drawn later;
 *   · `"suit/classic"`  — that one design.
 * `style` is ALWAYS the first entry's style, so every reader that knows only `style` (the seat plan, the prints, the
 * reminders, the reader's own panel) reads the hero's style, unchanged.
 * 🔁 BACKWARD COMPATIBLE BOTH WAYS: no `designs` (every dress code before today) is `[style]` — the whole style, i.e.
 * exactly the one drawing it always drew; `designs` whose first style is not `style` (an older writer changed `style`
 * and kept them) is IGNORED — `style` wins, as before this existed. A writer that never heard of `designs` cannot make
 * a column draw what it did not say.
 *
 * Pure, client-safe.
 */
import { DESIGN_LIBRARY, DESIGNS_PER_STYLE_MAX, isDrawn, variantArtKey, type LibraryDesign } from './attire-library';
import { columnRole, designLabel, roleDesigns, type FigureRole } from './attire-designs';
import { FIGURE_ART, artZoneKeys, type FigureArt, type FigureGarment } from './attire-figures';
import { isAttireStyle, type AttireStyle } from './role-dress-code';
import { picksOf, sanitizeSecondPicks, withFirstStyle, withSecondStyle, type AttireRowDef, type AttireTier, type ReadPick } from './attire-rows';

/* 👔 Every DRAWN design of a style's five joins the drawings (`FIGURE_ART`) — here, the one door to a design key. The
   shipped first design already is one of the 45.
   Each is drawn from its own folder, `public/attire/roles/<role>-<style>/<variant>`, in its STYLE's zones; an undrawn row
   is never added, so nothing can render it. (Added here, not in `attire-figures.ts`, so the Maker's first load — which
   reaches that file — never carries the library: `check-maker-js-budget.mjs`, 2026-10-21.) */
for (const [role, designs] of Object.entries(DESIGN_LIBRARY)) {
  for (const d of designs ?? []) {
    if (d.art || typeof d.w !== 'number') continue;
    const key = variantArtKey(role as FigureRole, d);
    const zones = artZoneKeys(d.style).map((z) => ({ key: z, mask: `/attire/roles/${key}-${z}.webp` }));
    (FIGURE_ART as Record<string, FigureArt>)[key] = { src: `/attire/roles/${key}.webp`, mask: zones[0]!.mask, w: d.w, h: 280, zones };
  }
}

/** Does this person's column choose STYLES AND DESIGNS (a role in the library — the guests)? */
export const hasDesignLibrary = (role: FigureRole | null | undefined): role is FigureRole => Boolean(role && DESIGN_LIBRARY[role]?.length);

/** A role's styles in the library's order (the prototype's: Suit and tie · Barong Tagalog · Smart casual). */
export function libraryStyles(role: FigureRole): AttireStyle[] {
  const own = roleDesigns(role);
  const out: AttireStyle[] = [];
  for (const d of DESIGN_LIBRARY[role] ?? []) if (own.includes(d.style) && !out.includes(d.style)) out.push(d.style);
  return out;
}

/** A style's DRAWN designs, in order — the only ones ever offered or drawn. */
export function drawnDesigns(role: FigureRole, style: AttireStyle): LibraryDesign[] {
  return (DESIGN_LIBRARY[role] ?? []).filter((d) => d.style === style && isDrawn(d)).slice(0, DESIGNS_PER_STYLE_MAX);
}

/** The drawing of a drawn design: the shipped role drawing, or its own folder's. */
export function designArt(role: FigureRole, d: LibraryDesign): FigureGarment {
  /* A design's own drawing is a key of `FIGURE_ART` once added above — typed as a role drawing. */
  return d.art ?? (variantArtKey(role, d) as unknown as FigureGarment);
}

const styleOfTick = (t: string): string => (t.includes('/') ? t.slice(0, t.indexOf('/')) : t);

/**
 * A column's ticks as stored → the ticks a reader may vouch for: known styles of THIS role, known designs of the
 * library, each once, the first one's style being `style`. Null when there is nothing to read past `style` (absent,
 * malformed, or written for another `style`) — the column is then `[style]`, exactly as before.
 */
export function sanitizeDesignTicks(role: FigureRole | null | undefined, style: AttireStyle | null | undefined, raw: unknown): string[] | null {
  if (!hasDesignLibrary(role) || !style || !Array.isArray(raw)) return null;
  const styles = libraryStyles(role);
  const lib = DESIGN_LIBRARY[role] ?? [];
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== 'string' || out.includes(t)) continue;
    const s = styleOfTick(t);
    if (!isAttireStyle(s) || !styles.includes(s)) continue;
    if (t.includes('/') && !lib.some((d) => `${d.style}/${d.variant}` === t)) continue;
    /* A whole style and one of its own designs never both — the whole style already says it. */
    if (out.includes(s) || (!t.includes('/') && out.some((o) => styleOfTick(o) === s))) continue;
    out.push(t);
  }
  if (out.length === 0 || styleOfTick(out[0]!) !== style) return null;
  return out;
}

/** One allowed style of a column, and its allowed drawn designs. */
export type AllowedStyle = {
  style: AttireStyle;
  /** The role's own word ("Suit and tie", "Long dress"). */
  label: string;
  /** Every design of the style is allowed (ticked whole — drawn now or later). */
  whole: boolean;
  designs: Array<{ id: string; label: string; art: FigureGarment }>;
  /** How many designs of the style are drawn. */
  drawn: number;
};

/**
 * What a column allows, as drawn designs grouped by style, in tick order (`ticks` null = `[style]`). Only DRAWN designs
 * — an allowed design with no drawing yet is not drawn anywhere; a style left with none drawn is not listed.
 */
export function allowedStyles(role: FigureRole, style: AttireStyle | null, ticks: readonly string[] | null): AllowedStyle[] {
  if (!style) return [];
  const list = ticks ?? [style];
  const order: AttireStyle[] = [];
  for (const t of list) {
    const s = styleOfTick(t) as AttireStyle;
    if (!order.includes(s)) order.push(s);
  }
  const out: AllowedStyle[] = [];
  for (const s of order) {
    const drawn = drawnDesigns(role, s);
    const whole = list.includes(s);
    const picked = whole ? drawn : drawn.filter((d) => list.includes(`${s}/${d.variant}`));
    if (picked.length === 0) continue;
    out.push({ style: s, label: designLabel(role, s), whole, designs: picked.map((d) => ({ id: `${s}/${d.variant}`, label: d.label, art: designArt(role, d) })), drawn: drawn.length });
  }
  return out;
}

/** Every allowed drawn design of a column, in order — the first is the hero. */
export function allowedDesigns(role: FigureRole, style: AttireStyle | null, ticks: readonly string[] | null): AllowedStyle['designs'] {
  return allowedStyles(role, style, ticks).flatMap((s) => s.designs);
}

/** The picker's keys: a style's head and a design's tile. */
export const styleKey = (s: AttireStyle): string => `style:${s}`;
export const designKey = (id: string): string => `design:${id}`;

/**
 * ✅ ONE TAP (owner 2026-10-21, prototype § 3; controller's call on open question 1 — "one tap = all five"):
 *   · a style's head — allowed whole → not allowed; else → allowed WHOLE (all its designs, one tap);
 *   · a design — allowed → narrowed out (a whole style becomes its other drawn designs; its last → the style goes);
 *     not allowed → added, and a style whose drawn designs are then all ticked is stored whole again.
 * Returns the column's new `style` (the first tick's — null when nothing is left) and `designs`.
 */
export function toggleDesignTick(role: FigureRole, style: AttireStyle | null, ticks: readonly string[] | null, key: string): { style: AttireStyle | null; designs: string[] } {
  let list: string[] = style ? [...(ticks ?? [style])] : [];
  const indexOfStyle = (s: string) => list.findIndex((t) => styleOfTick(t) === s);
  const replaceStyle = (s: string, next: string[]) => {
    const at = indexOfStyle(s);
    const rest = list.filter((t) => styleOfTick(t) !== s);
    if (at < 0) list = [...rest, ...next];
    else list = [...rest.slice(0, at), ...next, ...rest.slice(at)];
  };
  if (key.startsWith('style:')) {
    const s = key.slice(6);
    if (!isAttireStyle(s) || !libraryStyles(role).includes(s)) return { style, designs: list };
    const allowed = allowedStyles(role, style, ticks).find((a) => a.style === s);
    const fullyOn = Boolean(allowed && (allowed.whole || allowed.designs.length === allowed.drawn));
    replaceStyle(s, fullyOn ? [] : [s]);
  } else if (key.startsWith('design:')) {
    const id = key.slice(7);
    const s = styleOfTick(id);
    if (!isAttireStyle(s)) return { style, designs: list };
    const drawn = drawnDesigns(role, s).map((d) => `${s}/${d.variant}`);
    if (!drawn.includes(id)) return { style, designs: list };
    const now = allowedStyles(role, style, ticks).find((a) => a.style === s)?.designs.map((d) => d.id) ?? [];
    const next = now.includes(id) ? now.filter((d) => d !== id) : drawn.filter((d) => d === id || now.includes(d));
    replaceStyle(s, next.length === drawn.length ? [s] : next);
  }
  const first = list[0];
  return { style: first ? (styleOfTick(first) as AttireStyle) : null, designs: list };
}

/** A count in words, as the prototype says it ("all five"). */
const WORD = ['no', 'one', 'two', 'three', 'four', 'five'];
/**
 * How much of a style is allowed, said: "all five" · "both" · the one design's name · "3 of 5" · "not allowed".
 * Counts are of DRAWN designs — the page never says "five" while it can draw one.
 */
export function styleAllowedSaid(a: AllowedStyle | undefined, drawn: number): string {
  if (!a) return 'not allowed';
  if (a.designs.length < drawn) return `${a.designs.length} of ${drawn}`;
  if (drawn === 1) return a.designs[0]!.label;
  return drawn === 2 ? 'both' : `all ${WORD[drawn] ?? drawn}`;
}

/* ── the reader and the writer of a row's ticks ─────────────────────────── */

type Config = Record<string, unknown> | null | undefined;

/**
 * A row's picks (`picksOf`, the ONE reader) with each column's ticks — only for a column whose person has a library
 * (the guests), only when they start with that column's own Wear. Every other pick keeps exactly the shape `picksOf`
 * gives. Kept here, not in `picksOf`, so the readers that never draw a design (the Maker's first load among them) never
 * carry the library.
 */
export function picksWithDesigns(config: Config, row: AttireRowDef): ReadPick[] {
  const picks = picksOf(config, row);
  const raw = (i: number): unknown =>
    i === 0
      ? (((config?.[row.tier] ?? {}) as Record<string, { designs?: unknown }>)[row.key] ?? {}).designs
      : sanitizeSecondPicks(config?.women)[row.tier]?.[row.key]?.designs;
  return picks.map((p, i) => {
    const t = sanitizeDesignTicks(columnRole(row.key, i as 0 | 1), p.style, raw(i));
    return t ? { ...p, designs: t } : p;
  });
}

/** The drawing a column's people wear: its first allowed design's — or null where its person has no library. */
export function heroArt(p: { style: AttireStyle | null; role?: FigureRole | null; designs?: readonly string[] | null }): FigureGarment | null {
  return hasDesignLibrary(p.role) ? (allowedDesigns(p.role, p.style, p.designs ?? null)[0]?.art ?? null) : null;
}

/**
 * 👔 A COLUMN'S STYLES AND DESIGNS, WRITTEN (`toggleDesignTick`): its Wear is the first tick's style, written where each
 * Wear has always been written (the first column through `withFirstStyle`, the second through `withSecondStyle`), and
 * `designs` beside it. A column back to ONE whole style stores no `designs` at all — the shape every dress code had
 * before, byte for byte.
 */
export function withColumnDesigns<C extends Record<string, unknown>>(
  config: C,
  tier: AttireTier,
  key: string,
  index: 0 | 1,
  style: AttireStyle | null,
  designs: readonly string[],
  write: (config: C, tier: AttireTier, key: string, style: string | null) => C,
): C {
  const keep = style && !(designs.length === 1 && designs[0] === style) ? [...designs] : null;
  const setOn = (map: Record<string, Record<string, unknown>>) => {
    const rule = map[key];
    if (!rule) return map;
    const { designs: _was, ...rest } = rule;
    return { ...map, [key]: keep ? { ...rest, designs: keep } : rest };
  };
  if (index === 1) {
    const next = withSecondStyle(config, tier, key, style) as C & { women?: Record<string, Record<string, Record<string, unknown>>> };
    const women = next.women ?? {};
    return { ...next, women: { ...women, [tier]: setOn({ ...(women[tier] ?? {}) }) } };
  }
  const next = withFirstStyle(config, tier, key, style, write);
  return { ...next, [tier]: setOn({ ...((next[tier] as Record<string, Record<string, unknown>> | undefined) ?? {}) }) };
}
