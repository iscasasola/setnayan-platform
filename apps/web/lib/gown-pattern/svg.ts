/**
 * 👗 gown-pattern/svg — the blocks drawn as one SVG sheet, 1 unit = 1 mm (plan step B6; prototype v180 `blockSVG`).
 * Pure string; no DOM. One ink: every line and word is `currentColor`, so the sheet follows the page's ink on screen
 * and prints black. Guide lines are dashed, the bust point a cross, the grain a double arrow. No prices on any sheet.
 * The 1:1 export (A4 tiles, pdf-lib) is step B12.
 * 🔒 lib/gown-pattern/pattern.test.ts
 */
import type { GownBlockPiece } from './skirt';

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const f = (x: number) => x.toFixed(1);

export function gownBlocksSvg(pieces: readonly GownBlockPiece[], label: string): string {
  const pad = 40;
  const gap = 60;
  let x0 = pad;
  let maxH = 0;
  let parts = '';
  const top = Math.min(0, ...pieces.flatMap((p) => p.outline.map((q) => q[1])));
  const padY = pad - top;
  for (const p of pieces) {
    const w = Math.max(...p.outline.map((q) => q[0]));
    const h = Math.max(...p.outline.map((q) => q[1])) - top;
    maxH = Math.max(maxH, h);
    const pts = p.outline.map(([x, y]) => `${f(x0 + x)},${f(padY + y)}`).join(' ');
    parts += `<polygon points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5"/>`;
    for (const d of p.darts) {
      parts +=
        'a' in d
          ? `<polyline points="${f(x0 + d.a[0])},${f(padY + d.a[1])} ${f(x0 + d.apex[0])},${f(padY + d.apex[1])} ${f(x0 + d.b[0])},${f(padY + d.b[1])}" fill="none" stroke="currentColor" stroke-width="2"/>`
          : `<polyline points="${f(x0 + d.x - d.w / 2)},${f(padY)} ${f(x0 + d.x)},${f(padY + d.len)} ${f(x0 + d.x + d.w / 2)},${f(padY)}" fill="none" stroke="currentColor" stroke-width="2"/>`;
    }
    for (const [px, py, t] of p.points) {
      parts += `<path d="M${f(x0 + px - 12)},${f(padY + py)}h24M${f(x0 + px)},${f(padY + py - 12)}v24" stroke="currentColor" stroke-width="3"/><text x="${f(x0 + px + 16)}" y="${f(padY + py - 10)}" font-size="24" fill="currentColor">${esc(t)}</text>`;
    }
    for (const [mx, my, t] of p.marks) {
      parts += `<line x1="${f(x0)}" y1="${f(padY + my)}" x2="${f(x0 + mx)}" y2="${f(padY + my)}" stroke="currentColor" stroke-width="1.5" stroke-dasharray="12 8"/><text x="${f(x0 + 10)}" y="${f(padY + my - 8)}" font-size="26" fill="currentColor">${esc(t)} line</text>`;
    }
    if (p.vent) {
      parts += `<line x1="${f(x0 + 2)}" y1="${f(padY + h + top - p.vent)}" x2="${f(x0 + 2)}" y2="${f(padY + h + top)}" stroke="currentColor" stroke-width="5"/>`;
    }
    const [[g1x, g1y], [g2x, g2y]] = p.grain;
    parts += `<line x1="${f(x0 + g1x)}" y1="${f(padY + g1y)}" x2="${f(x0 + g2x)}" y2="${f(padY + g2y)}" stroke="currentColor" stroke-width="2" marker-start="url(#gown-grain)" marker-end="url(#gown-grain)"/>`;
    const ty = p.labelY ?? Math.min(h + top - 40, 160);
    parts += `<text x="${f(x0 + 20)}" y="${f(padY + ty)}" font-size="34" font-weight="700" fill="currentColor">${esc(p.name)}</text><text x="${f(x0 + 20)}" y="${f(padY + ty + 40)}" font-size="26" fill="currentColor">${esc(p.cut)}</text>`;
    x0 += w + gap;
  }
  const W = x0 - gap + pad;
  const Ht = maxH + pad * 2;
  return `<svg viewBox="0 0 ${f(W)} ${f(Ht)}" width="${f(W)}mm" height="${f(Ht)}mm" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}"><defs><marker id="gown-grain" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>${parts}</svg>`;
}
