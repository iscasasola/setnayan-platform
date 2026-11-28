/**
 * 👗 THE 1:1 EXPORT (plan step B12; owner D28: A4 and US Letter). The test square is 50.0 mm in the file; the tiles
 * cover the whole sheet with no gap and no overlap, so taped together they rebuild it within 0.5 mm; page 1 says to
 * measure the square, says the allowances (or "net pattern"), and carries "ESTIMATE: measure before cutting" exactly
 * when a number is an estimate; no money anywhere. The owner's print test (page 1, a ruler on the square) is the
 * acceptance check after it ships.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-pattern/export.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startingGownBody, startingGownConfig, type GownMeasures } from '../gown-config';
import { gownOrderBlocks } from './order';
import { GOWN_SEAM_ALLOWANCE_DEFAULT } from './allowance';
import { GOWN_EXPORT_MARGIN_MM, GOWN_PAPERS, PT_PER_MM, clipSegment, gownExportPdf, gownExportPlan, type GownExportOp } from './export';

const measures: GownMeasures = { waistHip: { cm: 22, from: 'typed' }, waistFloor: { cm: 100, from: 'typed' } };
const pieces = (sil: 'sheath' | 'ball' = 'sheath') => {
  const b = gownOrderBlocks({ ...startingGownConfig(), sil }, startingGownBody(), measures);
  assert.ok(b.skirt.ok);
  return b.skirt.ok ? b.skirt.pieces : [];
};
const texts = (ops: readonly GownExportOp[]) => ops.filter((o): o is Extract<GownExportOp, { k: 'text' }> => o.k === 'text').map((o) => o.text);

test('1 · page 1: the 5 cm square is 141.73 pt (50.0 mm) in the file, and the page says to measure it', () => {
  const plan = gownExportPlan(pieces(), { paper: 'a4', allowance: GOWN_SEAM_ALLOWANCE_DEFAULT, title: 'Ana: skirt', estimate: false });
  const sq = plan.pages[0]!.ops.find((o) => o.k === 'rect');
  assert.ok(sq && sq.k === 'rect');
  assert.equal((sq.w / PT_PER_MM).toFixed(1), '50.0');
  assert.equal((sq.h / PT_PER_MM).toFixed(1), '50.0');
  assert.equal(sq.w.toFixed(2), '141.73');
  const t = texts(plan.pages[0]!.ops).join(' | ');
  assert.match(t, /Print at 100% \(actual size\) on A4\. Measure the square first: it must be 5 cm\./);
  assert.match(t, /Seam allowances included: seams 1\.5 cm, hem 4 cm, zip 2 cm/);
  assert.doesNotMatch(t, /ESTIMATE/);
});

test('2 · the tiles cover the sheet exactly: paper minus margins, no gap, no overlap, in both papers', () => {
  for (const paper of ['a4', 'letter'] as const) {
    const plan = gownExportPlan(pieces('ball'), { paper, allowance: GOWN_SEAM_ALLOWANCE_DEFAULT, title: 'x', estimate: false });
    const P = GOWN_PAPERS[paper], tw = P.wMm - 2 * GOWN_EXPORT_MARGIN_MM, th = P.hMm - 2 * GOWN_EXPORT_MARGIN_MM;
    assert.equal(plan.cols, Math.ceil(plan.sheetMm.w / tw));
    assert.equal(plan.rows, Math.ceil(plan.sheetMm.h / th));
    assert.equal(plan.pages.length, 1 + plan.rows * plan.cols);
    for (const pg of plan.pages) { assert.equal((pg.wPt / PT_PER_MM).toFixed(1), P.wMm.toFixed(1)); assert.equal((pg.hPt / PT_PER_MM).toFixed(1), P.hMm.toFixed(1)); }
    // the same sheet point on two neighbouring tiles lands exactly one tile-width apart (taped edge to edge: 0 mm error)
    const firstLine = (i: number) => plan.pages[i]!.ops.find((o) => o.k === 'line' && o.pts.length > 3) as Extract<GownExportOp, { k: 'line' }>;
    if (plan.cols > 1) {
      const a = firstLine(1).pts[0]!, b = firstLine(2).pts[0]!;
      assert.ok(Math.abs((a[0] - b[0]) / PT_PER_MM - tw) < 0.5, 'neighbouring tiles do not butt together');
      assert.ok(Math.abs(a[1] - b[1]) < 1e-6);
    }
    assert.ok(plan.rows * plan.cols > 1, 'a circle skirt fits on one page?');
    assert.deepEqual(plan.pages.slice(1, 3).map((p) => p.name), ['A1', plan.cols > 1 ? 'A2' : 'B1']);
  }
});

test('3 · the estimate line shows exactly when a number is an estimate; a net pattern says so', () => {
  const est = gownExportPlan(pieces(), { paper: 'letter', allowance: GOWN_SEAM_ALLOWANCE_DEFAULT, title: 'x', estimate: true });
  assert.ok(texts(est.pages[0]!.ops).includes('ESTIMATE: measure before cutting'));
  const net = gownExportPlan(pieces(), { paper: 'letter', allowance: { ...GOWN_SEAM_ALLOWANCE_DEFAULT, on: false }, title: 'x', estimate: false });
  assert.ok(texts(net.pages[0]!.ops).some((t) => t.startsWith('Net pattern: no seam allowances')));
  assert.ok(!net.pages.slice(1).some((p) => p.ops.some((o) => o.k === 'line' && o.dash && o.pts.length > 3)), 'a net pattern draws no dashed sewing line');
});

test('4 · the clip keeps only what is inside a tile', () => {
  assert.deepEqual(clipSegment(0, 5, 20, 5, { x0: 10, y0: 0, x1: 30, y1: 10 }), [10, 5, 20, 5]);
  assert.equal(clipSegment(0, 20, 5, 25, { x0: 10, y0: 0, x1: 30, y1: 10 }), null);
});

test('5 · the PDF: one page per plan page at the paper size; pdf-lib is loaded only by the export function', async () => {
  const plan = gownExportPlan(pieces(), { paper: 'a4', allowance: GOWN_SEAM_ALLOWANCE_DEFAULT, title: 'Ana: skirt', estimate: true });
  const bytes = await gownExportPdf(plan);
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), plan.pages.length);
  const { width, height } = doc.getPage(0).getSize();
  assert.equal((width / PT_PER_MM).toFixed(1), '210.0');
  assert.equal((height / PT_PER_MM).toFixed(1), '297.0');
  const src = readFileSync(join(__dirname, 'export.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.doesNotMatch(src, /^import[^;]*from 'pdf-lib'/m, 'pdf-lib is imported at the top, so it loads with the page');
  assert.match(src, /await import\('pdf-lib'\)/);
  assert.doesNotMatch(src, /₱|centavo|formatPhp|price/i, 'the export talks about money');
});
