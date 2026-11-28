/**
 * 👗 THE 1:1 EXPORT (plan step B12; drawing v205; owner D28: A4 and US Letter). Held to the prototype's OWN `patBuild`
 * on six whole orders, on both papers: the page count, which pages are tiles and which a measured diagram, each page's
 * name, "Page n of N" on every page, and where the 5 cm test square sits on every page equal v205's
 * (prototype-v205.golden.json). Then the file itself: one PDF page per page at the paper's size, the test square
 * 50.0 mm in it, pdf-lib loaded only on export, and no money anywhere. The owner's print test (a ruler on the square)
 * is the acceptance check after it ships.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-pattern/export.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import golden from './prototype-v205.golden.json';
import { draftSkirt, type GownBlockPiece } from './skirt';
import { draftBodice } from './bodice';
import { GOWN_SEAM_ALLOW_DEFAULT, gownSeamAllowClean } from './allowance';
import { GOWN_PAPERS, PT_PER_MM, gownPageSvg, gownPatternPages, gownPatternPdf, type GownPaper } from './export';
import type { GownDraftOrder } from './inputs';

type Pages = { total: number; tiles: number; diagrams: { piece: string; pages: number }[]; perPiece: unknown[]; kinds: string[]; labels: string[]; squares: number[][]; heads: string[] };
const G = golden as unknown as {
  cutCases: { name: string; order: { est: Record<string, number>; vals: Record<string, number>; sil: string; netPattern: boolean; seamAllow: Record<string, number> | null; client: string }; pages: Record<GownPaper, Pages> }[];
};

function listOf(o: { est: Record<string, number>; vals: Record<string, number>; sil: string }): { p: GownBlockPiece }[] {
  const order = {
    vals: o.vals,
    sil: o.sil,
    hem: 'floor',
    measures: Object.fromEntries(Object.entries(o.est).map(([k, cm]) => [k, { cm, from: 'estimate' }])),
    ease: [{ part: 'Bust', ease: 2.5 }, { part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: 6 }],
  } as unknown as GownDraftOrder;
  const bo = draftBodice(order, {}), dr = draftSkirt(order, {}), out: { p: GownBlockPiece }[] = [];
  if (bo.ok) out.push(...bo.pieces.map((p) => ({ p })));
  if (dr.ok) out.push(...dr.pieces.map((p) => ({ p })));
  return out;
}
const bookOf = (c: (typeof G.cutCases)[number], paper: GownPaper) =>
  gownPatternPages(listOf(c.order), { sa: c.order.seamAllow ? gownSeamAllowClean(c.order.seamAllow) : GOWN_SEAM_ALLOW_DEFAULT, net: c.order.netPattern, paper, who: c.order.client });

test('1 · six orders × two papers: pages, tiles, diagrams, names, "Page n of N" and every test square equal the prototype’s', () => {
  assert.equal(G.cutCases.length, 6);
  for (const c of G.cutCases)
    for (const paper of ['a4', 'letter'] as const) {
      const B = bookOf(c, paper), want = c.pages[paper], at = `${c.name} (${paper})`;
      assert.equal(B.total, want.total, `${at}: total`);
      assert.equal(B.tiles, want.tiles, `${at}: tiles`);
      assert.deepEqual(B.diagrams, want.diagrams, `${at}: diagrams`);
      assert.deepEqual(B.perPiece, want.perPiece, `${at}: per piece`);
      assert.deepEqual(B.pages.map((p) => p.kind), want.kinds, `${at}: kinds`);
      assert.deepEqual(B.pages.map((p) => p.label), want.labels, `${at}: labels`);
      assert.deepEqual(B.pages.map((p) => p.head), want.heads, `${at}: Page n of N`);
      B.pages.forEach((p, i) => {
        assert.ok(Math.abs(p.square[0] - want.squares[i]![0]!) < 0.01 && Math.abs(p.square[1] - want.squares[i]![1]!) < 0.01, `${at} page ${i + 1}: the square moved`);
        const sq = p.ops.filter((o) => o.k === 'rect' && o.testSquare);
        assert.equal(sq.length, 1, `${at} page ${i + 1}: one test square`);
        assert.ok(sq[0]!.k === 'rect' && sq[0]!.w === 50 && sq[0]!.h === 50, `${at} page ${i + 1}: the square is not 5 cm`);
      });
    }
  assert.ok(G.cutCases.some((c) => c.pages.a4.diagrams.length), 'no case exercised the measured diagram');
});

test('2 · the page map says how to print, the allowances (or net pattern), and marks blank pages —', () => {
  const plain = bookOf(G.cutCases[0]!, 'a4'), map = plain.pages[0]!.ops.filter((o) => o.k === 'text').map((o) => (o.k === 'text' ? o.text : ''));
  const said = map.join(' ').replace(/\s+/g, ' ');
  assert.ok(said.includes('1. Print at 100 % (actual size). Turn off “fit to page”.'));
  assert.ok(said.includes('Dashed line: cut (seams 1.5 cm, hem 2.5 cm, zip 2 cm, necklines and armholes 1 cm).'), said);
  assert.ok(map.includes('—'), 'no blank page was marked on the map');
  const net = bookOf(G.cutCases.find((c) => c.order.netPattern)!, 'a4').pages[0]!.ops.map((o) => (o.k === 'text' ? o.text : '')).join(' ').replace(/\s+/g, ' ');
  assert.match(net, /This is a net pattern: add your own allowance as you cut\./);
  const diag = bookOf(G.cutCases.find((c) => c.pages.a4.diagrams.length)!, 'a4').pages.find((p) => p.kind === 'diagram')!;
  const facts = diag.ops.map((o) => (o.k === 'text' ? o.text : '')).join(' ').replace(/\s+/g, ' ');
  assert.match(facts, /Too big to print at home: 46 pages on A4\./);
  assert.match(facts, /Waist radius [\d.]+ cm \(stitching line\); hem radius [\d.]+ cm, both from the same corner point\./);
});

test('3 · the PDF: one page per page at the paper’s size, the test square 50.0 mm, pdf-lib loaded only on export', async () => {
  const B = bookOf(G.cutCases[2]!, 'letter');
  const bytes = await gownPatternPdf(B, 'Ana Reyes · pattern');
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), B.total);
  const { width, height } = doc.getPage(1).getSize();
  assert.equal((width / PT_PER_MM).toFixed(1), GOWN_PAPERS.letter.w.toFixed(1));
  assert.equal((height / PT_PER_MM).toFixed(1), GOWN_PAPERS.letter.h.toFixed(1));
  assert.equal((50 * PT_PER_MM).toFixed(2), '141.73', 'the 5 cm square is 141.73 pt in the file');
  const src = readFileSync(join(__dirname, 'export.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.doesNotMatch(src, /^import[^;]*from 'pdf-lib'/m, 'pdf-lib is imported at the top, so it loads with the page');
  assert.match(src, /await import\('pdf-lib'\)/);
  assert.doesNotMatch(src, /₱|centavo|formatPhp|price/i, 'the export talks about money');
});

test('4 · the on-screen page is the same page: an SVG at true size with the square at 50 × 50 mm', () => {
  const B = bookOf(G.cutCases[0]!, 'a4'), svg = gownPageSvg(B.pages[1]!.ops, B.aw, B.ah);
  assert.match(svg, /width="190\.00mm" height="277\.00mm"/);
  assert.match(svg, /class="pp-test" x="[\d.]+" y="[\d.]+" width="50\.00" height="50\.00"/);
  assert.doesNotMatch(svg, /<script/i);
});
