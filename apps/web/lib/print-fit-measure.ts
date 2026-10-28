/**
 * lib/print-fit-measure.ts — MEASURE A DRAWN CARD: what overlaps, what leaves
 * the safe line, what is too small, what is cut off, what cannot be read.
 *
 * Owner 2026-10-16, looking at the Event pass size picker (Calling card · ID
 * card · Train ticket · Boarding pass · Phone card): *"check the alignment of
 * the names and elements on the print. make sure nothing overlaps, make
 * everything legible"*.
 *
 * It reads the SAME op list both backends draw (`lib/print-render-pdf.ts`,
 * `lib/print-render-svg.ts`) — the PDF is those ops and nothing else — so a
 * box here is a box on paper:
 *   · a line of type is its outline path's ink box (the glyphs as cut from the
 *     TTF, accents and descenders included), with the size it was set at
 *     (`PrintTextMeta`, written by the one type setter);
 *   · a code is its image PLUS the white plate it sits on (a scanner needs
 *     that quiet zone; type on it is type on the code);
 *   · the couple's logo is its outline parts, as one element;
 *   · the NFC sticker spot is its circle.
 *
 * Contrast is composited from the ops UNDER a line, at five points of its box,
 * in drawing order — the paper, a veil, a band, a pill, a tile. A photo (the
 * theme's still) is taken at BOTH of its measured extremes (the registry's
 * `media.samples` light and dark), so a line passes only if it reads on the
 * lightest AND the darkest part of the picture behind it.
 *
 * PURE. No I/O: the guard test and the contact-sheet script both call it.
 */
import { MIN_CONTRAST, groundsAt, hexRgb, pathBounds, samplePoints, worstContrast, type Box } from '@/lib/print-ground';
import { safeContainsBox, type PrintDoc, type PrintOp, type PrintTextMeta } from '@/lib/print-layout';
import { printableText, type PrintLook } from '@/lib/print-pieces';

export { MIN_CONTRAST, pathBounds, type Box };

/**
 * THE LEGIBLE FLOORS, in points.
 *
 * · SECONDARY 6 pt — `PRINT_MIN_BODY_PT` (lib/print-layout.ts) already holds
 *   every card's words to it: the size 21 CFR 101.9(d)(1)(iii) sets for text
 *   the public must read on print, and the smallest body size print shops
 *   accept for a serif. The pass's labels (EVENT PASS, ADMIT, SCAN AT THE
 *   DOOR, TABLE) are tracked caps, which read at it.
 * · THE GUEST'S NAME 8 pt — the name is what the door staff read off the card
 *   at arm's length, and what the guest looks for in a stack. 8 pt is the
 *   smallest size a business card sets a person's NAME at (its secondary
 *   lines run 7–8 pt; the name is never the smallest thing on it), and the
 *   pass's own design asks 10.5 pt on a calling card — 8 pt is the floor a
 *   very long name may shrink to before it WRAPS to a second line.
 */
export const LEGIBLE_FLOOR_PT = 6;
export const NAME_FLOOR_PT = 8;

export type TextEl = { kind: 'text'; box: Box; meta: PrintTextMeta; color: string; opacity: number; index: number };
export type El =
  | TextEl
  | { kind: 'qr'; box: Box; index: number }
  | { kind: 'mark'; box: Box; index: number }
  | { kind: 'nfc'; box: Box; index: number }
  | { kind: 'ring'; box: Box; index: number }
  | { kind: 'ornament'; box: Box; index: number };

export function opBox(o: PrintOp): Box | null {
  if (o.t === 'rect' || o.t === 'image') return { x: o.x, y: o.y, w: o.w, h: o.h };
  if (o.t === 'circle') return { x: o.cx - o.r, y: o.cy - o.r, w: o.r * 2, h: o.r * 2 };
  return pathBounds(o.d);
}

const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
/** Strict overlap, with a hair of tolerance so two boxes that only TOUCH pass. */
export const intersects = (a: Box, b: Box, eps = 0.05) =>
  a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
const contains = (outer: Box, inner: Box, eps = 0.05) =>
  inner.x >= outer.x - eps && inner.y >= outer.y - eps && inner.x + inner.w <= outer.x + outer.w + eps && inner.y + inner.h <= outer.y + outer.h + eps;

const isWhite = (c: string | undefined) => !!c && /^#?f{6}$/i.test(c.trim());
const isCode = (o: PrintOp) => o.t === 'image' && o.ref !== 'still' && o.ref !== 'mark' && o.ref !== 'posterBg';

/** The measurable elements of a card, in drawing order. White-ink underprints are skipped (they duplicate the ink). */
export function elementsOf(doc: PrintDoc): El[] {
  const out: El[] = [];
  let mark: { box: Box; index: number } | null = null;
  doc.ops.forEach((o, index) => {
    if (o.t === 'path' && o.layer === 'white') return;
    if (o.t === 'path' && o.text) {
      const box = o.text.box ?? pathBounds(o.d);
      if (box) out.push({ kind: 'text', box, meta: o.text, color: o.fill ?? '#000000', opacity: o.opacity ?? 1, index });
      return;
    }
    if ((o.t === 'path' && o.mark) || (o.t === 'image' && o.ref === 'mark')) {
      const b = opBox(o);
      if (b) mark = mark ? { box: union(mark.box, b), index: mark.index } : { box: b, index };
      return;
    }
    if (isCode(o) && o.t === 'image') {
      // The code and its quiet zone: the white plate drawn just before it, as
      // far as it reaches on the code's LEFT — the same margin on every side. A
      // Poster tile that runs on below the code to hold Table · Arrive is the
      // tile's paper, not the code's quiet zone.
      let plate: Box = { x: o.x, y: o.y, w: o.w, h: o.h };
      for (let j = index - 1; j >= 0; j -= 1) {
        const p = doc.ops[j]!;
        if (p.t === 'image' || (p.t === 'path' && (p.text || p.mark))) break;
        if (!isWhite(p.fill)) break;
        const pb = opBox(p);
        if (!pb) break;
        plate = union(plate, pb);
      }
      const m = Math.max(0, o.x - plate.x);
      out.push({ kind: 'qr', box: { x: o.x - m, y: o.y - m, w: o.w + 2 * m, h: o.h + 2 * m }, index });
      return;
    }
    // A small filled ornament (the rule's diamond, a dot) — type must clear it too.
    if (o.t === 'path' && o.fill && !o.layer) {
      const b = pathBounds(o.d);
      if (b && b.w < 12 && b.h < 12) out.push({ kind: 'ornament', box: b, index });
      return;
    }
    if (o.t === 'circle' && o.fill && !o.stroke && o.r < 6) {
      out.push({ kind: 'ornament', box: opBox(o)!, index });
      return;
    }
    if (o.t === 'circle' && o.nfc) {
      out.push({ kind: 'nfc', box: opBox(o)!, index });
      return;
    }
    if (o.t === 'circle' && o.stroke && !o.fill) out.push({ kind: 'ring', box: opBox(o)!, index });
  });
  if (mark) out.push({ kind: 'mark', ...(mark as { box: Box; index: number }) });
  return out;
}

/**
 * EVERY LINE ON THE CARD THE TYPE MUST NOT CROSS (coordinator, 2026-10-16,
 * the owner's phone card: "SCANS ONCE AT THE DOOR" printed ON the inner
 * frame's bottom stroke). Lines and frames are elements too:
 *   · a hairline rect — a rule, a tear line's dash, a perforation;
 *   · a STROKED frame (a path or a rect drawn with `stroke` and no fill — the
 *     Classic ticket's inner border, a pending request's dashed band) — as
 *     its four edges, `sw` thick, so type INSIDE the frame is fine and type
 *     ON its line is not;
 *   · a stroked circle (the round code's slot ring) — as its circumference.
 * Full-width band edges (a background) are excluded.
 */
type Stroke = { kind: 'band'; box: Box } | { kind: 'ring'; cx: number; cy: number; r: number; sw: number };
export function strokesOf(doc: PrintDoc): Stroke[] {
  const out: Stroke[] = [];
  const edges = (b: Box, sw: number) => {
    const t = Math.max(sw, 0.4);
    out.push({ kind: 'band', box: { x: b.x - t / 2, y: b.y - t / 2, w: b.w + t, h: t } });
    out.push({ kind: 'band', box: { x: b.x - t / 2, y: b.y + b.h - t / 2, w: b.w + t, h: t } });
    out.push({ kind: 'band', box: { x: b.x - t / 2, y: b.y - t / 2, w: t, h: b.h + t } });
    out.push({ kind: 'band', box: { x: b.x + b.w - t / 2, y: b.y - t / 2, w: t, h: b.h + t } });
  };
  for (const o of doc.ops) {
    if (o.t === 'rect') {
      if (o.stroke && !o.fill) {
        edges({ x: o.x, y: o.y, w: o.w, h: o.h }, o.sw ?? 0.5);
        continue;
      }
      if (!o.fill || o.dash) continue;
      if (Math.min(o.w, o.h) > 1.6) continue;
      if (o.x <= 0.01 && o.x + o.w >= doc.w - 0.01) continue; // a full-width band edge
      out.push({ kind: 'band', box: { x: o.x, y: o.y, w: o.w, h: o.h } });
    } else if (o.t === 'path' && o.stroke && !o.fill && !o.text) {
      const b = pathBounds(o.d);
      if (b) edges(b, o.sw ?? 0.5);
    } else if (o.t === 'circle' && o.stroke && !o.fill && !o.nfc) {
      out.push({ kind: 'ring', cx: o.cx, cy: o.cy, r: o.r, sw: Math.max(o.sw ?? 0.5, 0.4) });
    }
  }
  return out;
}

/** Does a box touch a stroke — a band's area, or a ring's circumference (straddling it)? */
function crosses(b: Box, s: Stroke): boolean {
  if (s.kind === 'band') return intersects(b, s.box, 0.01);
  const nx = Math.max(b.x, Math.min(s.cx, b.x + b.w));
  const ny = Math.max(b.y, Math.min(s.cy, b.y + b.h));
  const near = Math.hypot(nx - s.cx, ny - s.cy);
  const far = Math.max(...[[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => Math.hypot(x! - s.cx, y! - s.cy)));
  return near < s.r + s.sw / 2 && far > s.r - s.sw / 2;
}

// ─── Colour ────────────────────────────────────────────────────────────────

/** The lowest contrast a line of type has against what is under it, over five points of its box. */
export function textContrast(doc: PrintDoc, look: PrintLook, t: TextEl): number {
  let min = Infinity;
  for (const [px, py] of samplePoints(t.box)) {
    min = Math.min(min, worstContrast(hexRgb(t.color), t.opacity, groundsAt(doc.ops, look.theme, t.index, px, py)));
  }
  return min;
}

// ─── The verdict ───────────────────────────────────────────────────────────

export type FitProblem = { rule: 'overlap' | 'safe' | 'floor' | 'clipped' | 'contrast' | 'hairline'; detail: string };

const describe = (e: El) => (e.kind === 'text' ? `"${e.meta.s}"` : e.kind);
const fmtBox = (b: Box) => `${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.w.toFixed(1)}×${b.h.toFixed(1)}`;

/**
 * Everything wrong with one drawn pass. `name` is the guest's name as given —
 * its lines are held to `NAME_FLOOR_PT` and must spell the whole name, or end
 * in an ellipsis.
 */
export function measurePass(doc: PrintDoc, look: PrintLook, name: string | null): FitProblem[] {
  const out: FitProblem[] = [];
  const els = elementsOf(doc);
  const texts = els.filter((e): e is TextEl => e.kind === 'text');

  // (a) no two elements overlap — type inside a ring (the initials) is the ring's own.
  for (let i = 0; i < els.length; i += 1) {
    for (let j = i + 1; j < els.length; j += 1) {
      const a = els[i]!;
      const b = els[j]!;
      if (!intersects(a.box, b.box)) continue;
      // Type inside a ring (the initials) or inside the NFC spot ("Tap here") is
      // theirs; a logo in its ring, and a round code in its slot ring, likewise.
      const holder = a.kind === 'ring' || a.kind === 'nfc' ? a : b.kind === 'ring' || b.kind === 'nfc' ? b : null;
      const other = holder === a ? b : a;
      if (holder && contains(holder.box, other.box)) continue;
      if (holder?.kind === 'ring' && other.kind === 'mark') continue;
      const mid = (q: Box) => [q.x + q.w / 2, q.y + q.h / 2] as const;
      if (holder?.kind === 'ring' && other.kind === 'qr' && Math.hypot(mid(holder.box)[0] - mid(other.box)[0], mid(holder.box)[1] - mid(other.box)[1]) < 0.5) continue; // the round code's own slot
      out.push({ rule: 'overlap', detail: `${describe(a)} at ${fmtBox(a.box)} overlaps ${describe(b)} at ${fmtBox(b.box)}` });
    }
  }
  // type never crosses a line: a rule, a frame, a tear line, a perforation, a slot's ring
  const strokes = strokesOf(doc);
  for (const t of texts) {
    for (const l of strokes) {
      if (crosses(t.box, l)) out.push({ rule: 'hairline', detail: `"${t.meta.s}" at ${fmtBox(t.box)} crosses a ${l.kind === 'ring' ? `ring r=${l.r.toFixed(1)}` : `line at ${fmtBox(l.box)}`}` });
    }
  }

  // (b) inside the safe area of the sheet's own cut
  for (const e of els) {
    if (!safeContainsBox(doc.die, doc.w, doc.h, e.box)) out.push({ rule: 'safe', detail: `${describe(e)} at ${fmtBox(e.box)} leaves the safe area of a ${doc.w.toFixed(0)}×${doc.h.toFixed(0)} sheet` });
  }

  // (c) the legible floors
  const plainName = name ? printableText(name).normalize('NFC').replace(/\s+/g, ' ') : null;
  const isNameLine = (t: TextEl) => {
    if (!plainName) return false;
    const s = t.meta.s.replace(/…$/, '').trim();
    return s.length >= 2 && plainName.toLowerCase().includes(s.toLowerCase()) && s.length >= Math.min(6, plainName.length);
  };
  for (const t of texts) {
    const floor = isNameLine(t) ? NAME_FLOOR_PT : LEGIBLE_FLOOR_PT;
    if (t.meta.size < floor - 0.01) out.push({ rule: 'floor', detail: `"${t.meta.s}" is set at ${t.meta.size.toFixed(2)} pt (floor ${floor} pt)` });
  }

  // (d) never wider than its room, and the name is WHOLE. ✂🚫 Owner 2026-10-29, on the printouts: *"some names get the
  // ..."* · *"we do not want that"* — a name that ends in "…" is a failure now, not an excuse: it wraps, then steps down
  // to the floor, and its slot grows (`lib/print-name-fit.ts`). Whitespace is ignored in the comparison, because a word
  // too long for the room at the floor is broken between letters (every letter still prints).
  for (const t of texts) {
    if (t.meta.maxWidth && t.meta.width > t.meta.maxWidth + 0.05) out.push({ rule: 'clipped', detail: `"${t.meta.s}" is ${t.meta.width.toFixed(1)} pt wide in ${t.meta.maxWidth.toFixed(1)} pt` });
  }
  if (plainName) {
    const drawn = texts.filter(isNameLine).map((t) => t.meta.s);
    const joined = drawn.join(' ').replace(/\s+/g, ' ').trim();
    const want = plainName.replace(/\s+/g, ' ').trim();
    const bare = (x: string) => x.replace(/\s+/g, '').toLowerCase();
    // WHOLE = some run of consecutive lines, read in drawing order, spells the name letter for letter. (A wrapped name's
    // short lines — "Dela", or the last letters of a word broken at the floor — are part of the run though they are
    // too short to be recognised as name lines on their own.)
    const target = bare(want);
    let whole = false;
    for (let i = 0; i < texts.length && !whole; i++) {
      let acc = '';
      for (let j = i; j < texts.length; j++) {
        acc += bare(texts[j]!.meta.s);
        if (acc === target) whole = true;
        if (whole || !target.startsWith(acc)) break;
      }
    }
    if (drawn.some((d) => d.includes('…'))) out.push({ rule: 'clipped', detail: `the name is cut: it prints as "${joined}" — a name is never shortened with "…"` });
    else if (drawn.length && !whole) out.push({ rule: 'clipped', detail: `the name prints as "${joined}" — not "${want}"` });
  }

  // (e) contrast
  for (const t of texts) {
    const c = textContrast(doc, look, t);
    if (c < MIN_CONTRAST - 0.005) out.push({ rule: 'contrast', detail: `"${t.meta.s}" (${t.color}${t.opacity < 1 ? ` @${t.opacity}` : ''}) reads ${c.toFixed(2)}:1` });
  }
  return out;
}
