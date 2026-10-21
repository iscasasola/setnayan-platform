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
import { designLabel, roleDesigns, type FigureRole } from './attire-designs';
import type { FigureGarment } from './attire-figures';
import { isAttireStyle, type AttireStyle } from './role-dress-code';

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
  return d.art ?? variantArtKey(role, d);
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
