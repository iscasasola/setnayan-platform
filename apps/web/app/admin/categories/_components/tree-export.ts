/**
 * tree-export.ts — Download ▾ on the Categories page (🌳 ③b; corpus PLAN admin_taxonomy_four_levels § 7.5):
 * the rows ONCE, for both formats — a CSV and an A4 printable tree (pdf-lib, the `lib/moodboard-printable.ts`
 * pattern: light, print-safe, Helvetica, ₱0 marginal cost).
 *
 * "What you see is what you export" (the growth export's rule): both follow the page's Show ▾ and search.
 *
 * CSV columns (PLAN § 7.5): group, category, service, service_key, part, part_key, home, hidden — one row
 * per service × part link; a service with no part is one row with empty part columns; a category with no
 * service is one row with empty service columns; a part whose services are all elsewhere still gets a row
 * — so every gap survives the export.
 */
import { formatCount } from '@/lib/format-number';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  categoriesOf,
  partsHomedIn,
  partsOfService,
  partCategoryIds,
  plural,
  servicesOf,
  textHit,
  serviceByKey,
  type MapCategory,
  type MapData,
  type MapGroup,
  type MapPart,
  type MapService,
} from './four-level-model';

export type TreeRow = { group: MapGroup; category: MapCategory; services: MapService[]; parts: MapPart[] };

export function treeRows(d: MapData, q: string, show: string): TreeRow[] {
  const query = q.trim();
  const rows: TreeRow[] = [];
  for (const g of d.groups) {
    for (const c of categoriesOf(d, g.id)) {
      const svcs = servicesOf(d, c.id);
      if (show === 'nosvc-cat' && svcs.length !== 0) continue;
      if (show === 'hidden' && !c.hidden && !partsHomedIn(d, c.id).some((p) => p.hidden)) continue;
      const parts = partsHomedIn(d, c.id).filter((p) =>
        show === 'hidden' ? p.hidden || c.hidden : show === 'nosvc-part' ? p.services.length === 0 : true,
      );
      const svcHits = query ? svcs.filter((s) => textHit(query, s.label)) : svcs;
      const partHits = query ? parts.filter((p) => textHit(query, p.label) || p.services.some((k) => textHit(query, serviceByKey(d, k)?.label ?? ''))) : parts;
      if (query && !textHit(query, c.label) && !textHit(query, g.label) && svcHits.length === 0 && partHits.length === 0) continue;
      if ((show === 'nosvc-part' || show === 'parts') && partHits.length === 0) continue;
      rows.push({ group: g, category: c, services: show === 'nosvc-cat' ? [] : svcHits, parts: partHits });
    }
  }
  return rows;
}

function cell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function treeCsv(d: MapData, rows: readonly TreeRow[]): string {
  const lines = [['group', 'category', 'service', 'service_key', 'part', 'part_key', 'home', 'hidden'].join(',')];
  for (const r of rows) {
    const links: Array<[MapService | null, MapPart | null]> = [];
    for (const s of r.services) {
      const ps = partsOfService(d, s.key);
      if (ps.length === 0) links.push([s, null]);
      for (const p of ps) links.push([s, p]);
    }
    for (const p of r.parts) if (!p.services.some((k) => r.services.some((s) => s.key === k))) links.push([null, p]);
    if (links.length === 0) links.push([null, null]);
    for (const [s, p] of links) {
      lines.push(
        [
          r.group.label,
          r.category.label,
          s?.label ?? '',
          s?.key ?? '',
          p?.label ?? '',
          p?.key ?? '',
          p ? (p.home === r.category.id ? 'yes' : 'no') : '',
          p ? (p.hidden ? 'yes' : 'no') : '',
        ]
          .map(cell)
          .join(','),
      );
    }
  }
  // A UTF-8 BOM so a spreadsheet opens "Groom’s attire" and "₱" correctly.
  return `﻿${lines.join('\n')}\n`;
}

// ── the printable tree ────────────────────────────────────────────────────────

const A4 = { w: 595.28, h: 841.89 };
const M = { top: 46, side: 40, bottom: 52 };
const INK = rgb(0.173, 0.165, 0.161); // #2C2A29
const SOFT = rgb(0.478, 0.463, 0.455);
const GOLD = rgb(0.549, 0.412, 0.196); // #8C6932 — the page's gap tone
const HAIR = rgb(0.82, 0.8, 0.78);

/** WinAnsi-safe (pdf-lib's standard fonts cannot encode every glyph). */
function ascii(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/₱/g, 'PHP ')
    .replace(/[^\x00-\xFF]/g, ' ');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = ascii(text).split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export async function treePdf(d: MapData, rows: readonly TreeRow[], meta: { filter: string; date: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Setnayan · Supplier categories');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];
  let page = doc.addPage([A4.w, A4.h]);
  pages.push(page);
  let y = A4.h - M.top;
  const W = A4.w - M.side * 2;
  const total = `${plural(d.groups.length, 'group')} · ${plural(d.categories.length, 'category', 'categories')} · ${plural(d.services.length, 'service')} · ${plural(d.parts.length, 'part')}`;

  const header = () => {
    page.drawText('Setnayan · Supplier categories', { x: M.side, y, size: 13, font: bold, color: INK });
    page.drawText(ascii(meta.date), { x: A4.w - M.side - font.widthOfTextAtSize(ascii(meta.date), 9), y: y + 2, size: 9, font, color: SOFT });
    y -= 13;
    page.drawText(ascii(meta.filter), { x: M.side, y, size: 9, font, color: SOFT });
    page.drawText(ascii(total), { x: A4.w - M.side - font.widthOfTextAtSize(ascii(total), 9), y, size: 9, font, color: SOFT });
    y -= 8;
    page.drawLine({ start: { x: M.side, y }, end: { x: A4.w - M.side, y }, thickness: 0.8, color: INK });
    y -= 14;
  };
  const ensure = (need: number) => {
    if (y - need >= M.bottom) return;
    page = doc.addPage([A4.w, A4.h]);
    pages.push(page);
    y = A4.h - M.top;
    header();
  };
  header();

  let lastGroup = '';
  for (const r of rows) {
    if (r.group.id !== lastGroup) {
      ensure(30);
      y -= 4;
      page.drawText(ascii(r.group.label), { x: M.side, y, size: 11.5, font: bold, color: INK });
      const n = plural(categoriesOf(d, r.group.id).length, 'category', 'categories');
      page.drawText(ascii(n), { x: A4.w - M.side - font.widthOfTextAtSize(n, 8.5), y, size: 8.5, font, color: SOFT });
      y -= 15;
      lastGroup = r.group.id;
    }
    ensure(16);
    const count = servicesOf(d, r.category.id).length;
    const right = `${count === 0 ? '0 services - gap' : plural(count, 'service')}${partsHomedIn(d, r.category.id).length ? ` · ${plural(partsHomedIn(d, r.category.id).length, 'part')}` : ''}`;
    page.drawText(ascii(r.category.label + (r.category.hidden ? ' (hidden)' : '')), { x: M.side + 14, y, size: 10, font: bold, color: INK });
    page.drawText(ascii(right), { x: A4.w - M.side - font.widthOfTextAtSize(ascii(right), 8.5), y, size: 8.5, font, color: count === 0 ? GOLD : SOFT });
    y -= 13;
    if (r.services.length) {
      for (const line of wrap(r.services.map((s) => s.label).join(' · '), font, 9, W - 28)) {
        ensure(12);
        page.drawText(line, { x: M.side + 28, y, size: 9, font, color: SOFT });
        y -= 11.5;
      }
    }
    for (const p of r.parts) {
      ensure(12);
      const pc = partCategoryIds(d, p).length;
      const pr = `${p.services.length === 0 ? '0 services' : plural(p.services.length, 'service')}${pc > 1 ? ` · ${pc} categories` : ''}`;
      page.drawText(ascii(`o ${p.label}${p.hidden ? ' (hidden)' : ''}`), { x: M.side + 28, y, size: 9, font, color: GOLD });
      page.drawText(ascii(pr), { x: A4.w - M.side - font.widthOfTextAtSize(ascii(pr), 8.5), y, size: 8.5, font, color: p.services.length === 0 ? GOLD : SOFT });
      y -= 11.5;
    }
    y -= 3;
  }
  if (rows.length === 0) page.drawText('Nothing matches.', { x: M.side, y, size: 10, font, color: SOFT });

  pages.forEach((pg, i) => {
    pg.drawLine({ start: { x: M.side, y: M.bottom - 16 }, end: { x: A4.w - M.side, y: M.bottom - 16 }, thickness: 0.5, color: HAIR });
    pg.drawText('setnayan.com/admin/categories · printed by the admin console', { x: M.side, y: M.bottom - 28, size: 8, font, color: SOFT });
    const n = `${formatCount(i + 1)} / ${formatCount(pages.length)}`;
    pg.drawText(n, { x: A4.w - M.side - font.widthOfTextAtSize(n, 8), y: M.bottom - 28, size: 8, font, color: SOFT });
  });
  return doc.save();
}
