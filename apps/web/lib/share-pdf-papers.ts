/**
 * lib/share-pdf-papers.ts — the paper sizes of the shared Share-as-PDF engine (`lib/share-pdf.ts`). Pure: no pdf-lib,
 * no node — the Paper ▾ picker (`app/_components/paper-picker.tsx`) imports it in the browser.
 */
/**
 * THE PAPERS. Owner 2026-10-29, "always use A4?" → documents: **A4 portrait by default**, or Letter ("short bond",
 * 8.5×11 in) or Long ("long bond", 8.5×13 in — the Philippine office size). And for posters: *"For some posters the
 * smallest will be A4 then A3, then whatever size?"* → **A4 · A3 · A2 · A1 · A0 · a custom W×H** (cm or in), portrait
 * or landscape. A3 landscape is also the floor-plan / seat-chart sheet (approved 2026-10-01, "A3 PRINT").
 *
 * Two lists, one engine: `SHARE_PDF_DOCUMENT_PAPERS` (what a data view's Share offers — `PaperPicker kind="document"`)
 * and `SHARE_PDF_POSTER_PAPERS` (what a poster's Share offers — `kind="poster"`, with Custom). Everything this engine
 * draws is VECTOR (glyph outlines, rules, the mark), so a file stays sharp at any size; a poster layout that places a
 * photo must embed it at print resolution for its largest size (≥ 150 ppi at the printed size), never a screen copy.
 * The document layout below reflows its margins, columns and page breaks to whichever sheet it is given; a poster
 * brings its own layout and uses `sheetPoints` for the size. Sizes in points (1 pt = 1/72 in), portrait.
 */
export const SHARE_PDF_PAPERS = {
  a4: { w: 595.28, h: 841.89, label: 'A4' },
  letter: { w: 612, h: 792, label: 'Letter (short bond)' },
  long: { w: 612, h: 936, label: 'Long bond (8.5 × 13 in)' },
  a3: { w: 841.89, h: 1190.55, label: 'A3' },
  a2: { w: 1190.55, h: 1683.78, label: 'A2' },
  a1: { w: 1683.78, h: 2383.94, label: 'A1' },
  a0: { w: 2383.94, h: 3370.39, label: 'A0' },
} as const;
export type SharePdfNamedPaper = keyof typeof SHARE_PDF_PAPERS;
/** A named sheet, or a custom one in points (portrait: w ≤ h is not required — orientation still applies). */
export type SharePdfPaper = SharePdfNamedPaper | { w: number; h: number };
/** What a data view's Share offers. A4 first — the default. */
export const SHARE_PDF_DOCUMENT_PAPERS: readonly SharePdfNamedPaper[] = ['a4', 'letter', 'long'];
/** What a poster's Share offers, smallest first, then Custom (`'custom'` is the picker's key for a W×H). */
export const SHARE_PDF_POSTER_PAPERS: readonly (SharePdfNamedPaper | 'custom')[] = ['a4', 'a3', 'a2', 'a1', 'a0', 'custom'];

const PT_PER_IN = 72;
const PT_PER_CM = 72 / 2.54;
/** A custom sheet's bounds: 10 cm to 500 cm a side (PDF's own page limit is 200 in ≈ 508 cm). */
export const CUSTOM_PAPER_CM = { min: 10, max: 500 } as const;
/** A custom W×H in cm or in → points, or null when either side is out of bounds or not a number. */
export function customPaper(w: number, h: number, unit: 'cm' | 'in'): { w: number; h: number } | null {
  const cm = unit === 'in' ? 2.54 : 1;
  const ok = (v: number) => Number.isFinite(v) && v * cm >= CUSTOM_PAPER_CM.min && v * cm <= CUSTOM_PAPER_CM.max;
  if (!ok(w) || !ok(h)) return null;
  const k = unit === 'in' ? PT_PER_IN : PT_PER_CM;
  return { w: Math.round(w * k * 100) / 100, h: Math.round(h * k * 100) / 100 };
}

/** The paper as a query value: a name, or `custom:<w>x<h>` in points. */
export function sharePdfPaperParam(p: SharePdfPaper): string {
  return typeof p === 'string' ? p : `custom:${p.w}x${p.h}`;
}
/**
 * A query value → a paper. `allowed` is the list the asking view offers (documents by default), so a document route
 * cannot be asked for an A0. Anything unknown, out of its list, or out of bounds is A4 — never a throw.
 */
export function sharePdfPaper(
  raw: string | null | undefined,
  allowed: readonly (SharePdfNamedPaper | 'custom')[] = SHARE_PDF_DOCUMENT_PAPERS,
): SharePdfPaper {
  const v = (raw ?? '').trim().toLowerCase();
  if (v.startsWith('custom:') && allowed.includes('custom')) {
    const m = /^custom:(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(v);
    const w = m ? Number(m[1]) : NaN;
    const h = m ? Number(m[2]) : NaN;
    return customPaper(w / PT_PER_CM, h / PT_PER_CM, 'cm') ?? 'a4';
  }
  return (allowed as readonly string[]).includes(v) && v in SHARE_PDF_PAPERS ? (v as SharePdfNamedPaper) : 'a4';
}
/** The sheet in points, with the orientation applied. */
export function sheetPoints(p: SharePdfPaper = 'a4', orientation: 'portrait' | 'landscape' = 'portrait'): { w: number; h: number } {
  const size = typeof p === 'string' ? SHARE_PDF_PAPERS[p] : p;
  const lo = Math.min(size.w, size.h);
  const hi = Math.max(size.w, size.h);
  return orientation === 'landscape' ? { w: hi, h: lo } : { w: lo, h: hi };
}
