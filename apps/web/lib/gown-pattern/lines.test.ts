/**
 * 🔒 B9 · the design's own lines on the cutting blocks (prototype v209 `lnBlocks`, `lnSummary`).
 *
 *   1 · held to the prototype: on v209's own drafts of twelve fixed orders, every design line the port draws is the
 *       prototype's to 1e-9 mm, with its label, and every order-sheet sentence is the prototype's word for word
 *       (prototype-v209-lines.golden.json, made by running gown_maker_v209.html — scripts/gown-lines-golden.mjs).
 *   2 · what the maker sends is checked: numbers in cm and the named words, refused (never thinned) otherwise.
 *   3 · the lines are drawn in rust, dash-dot, labelled, on screen and on the printed pages; never a price.
 * Run from apps/web: npx tsx --test lib/gown-pattern/lines.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import golden from './prototype-v209-lines.golden.json';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { draftMeasure, type GownDraftOrder } from './inputs';
import { gownLinesOnBlocks, gownLinesSummary, sanitizeGownOrderLines, type GownOrderLines } from './lines';
import { GOWN_PAT_INK, gownPieceDraw } from './export';
import { gownPieceGeom } from './allowance';
import { gownBlocksSvg } from './svg';
import type { GownMeasures } from '../gown-config';

type GoldenPiece = { name: string; style: { label: string; pts: [number, number][] }[] };
const G = golden as unknown as {
  input: { vals: Record<string, number>; skirtEstimate: Record<string, number>; bodiceEstimate: Record<string, number>; ease: { part: string; ease: number }[] };
  cases: { name: string; sil: string; lines: GownOrderLines; highNeck: boolean; bodice: GoldenPiece[] | string; skirt: GoldenPiece[] | string; summary: string[] }[];
};

function orderOf(sil: string): GownDraftOrder {
  const measures: GownMeasures = {};
  for (const [k, cm] of Object.entries({ ...G.input.skirtEstimate, ...G.input.bodiceEstimate })) (measures as Record<string, unknown>)[k] = { cm, from: 'estimate' };
  return { vals: G.input.vals, sil: sil as GownDraftOrder['sil'], designV: 2, hem: 'floor', measures, ease: G.input.ease.map((r) => ({ part: r.part, body: 1, ease: r.ease, gown: 0 })) };
}
function drawn(sil: string, lines: GownOrderLines | null) {
  const order = orderOf(sil), bodice = draftBodice(order), skirt = draftSkirt(order);
  gownLinesOnBlocks(lines, draftMeasure(order, {}, 'waistFloor')[0], bodice, skirt);
  return { bodice, skirt };
}

test('1 · the golden file holds v209’s twelve orders, and every line the port draws is the prototype’s', () => {
  assert.equal(G.cases.length, 12);
  let lines = 0;
  for (const c of G.cases) {
    const { bodice, skirt } = drawn(c.sil, c.lines);
    for (const [port, proto, what] of [[bodice, c.bodice, 'bodice'], [skirt, c.skirt, 'skirt']] as const) {
      assert.ok(port.ok && typeof proto !== 'string', `${c.name}: ${what} did not draft`);
      if (!port.ok || typeof proto === 'string') continue;
      assert.equal(port.pieces.length, proto.length, `${c.name}: ${what} pieces`);
      port.pieces.forEach((p, i) => {
        const want = proto[i]!.style, got = p.style ?? [];
        assert.equal(p.name, proto[i]!.name);
        assert.equal(got.length, want.length, `${c.name} · ${p.name}: ${got.length} lines, the prototype draws ${want.length}`);
        got.forEach((s, j) => {
          assert.equal(s.label, want[j]!.label, `${c.name} · ${p.name} · label`);
          assert.equal(s.pts.length, want[j]!.pts.length, `${c.name} · ${p.name} · points`);
          s.pts.forEach((q, k) => {
            for (const n of [0, 1]) assert.ok(Math.abs(q[n]! - want[j]!.pts[k]![n]!) <= 1e-9, `${c.name} · ${p.name} · ${s.label}[${k}][${n}]: port ${q[n]} ≠ prototype ${want[j]!.pts[k]![n]}`);
          });
          lines++;
        });
      });
    }
    assert.deepEqual(gownLinesSummary(c.lines, c.highNeck), c.summary, `${c.name}: the order sheet`);
  }
  // Anti-vacuity: the cases between them draw every kind of line, the circle skirt draws none, and both of the
  // neckline's shoulder branches are taken (18 points: on the shoulder seam; 19: below it, across to the armhole).
  assert.equal(lines, 23, `${lines} lines compared`);
  const labels = new Set(G.cases.flatMap((c) => [c.bodice, c.skirt].flatMap((x) => (typeof x === 'string' ? [] : x.flatMap((p) => p.style.map((s) => s.label))))));
  for (const l of ['design neckline', 'design neckline (custom)', 'design back', 'design back (custom)', 'design hem', 'design hem (scalloped)', 'design hem (curved)']) assert.ok(labels.has(l), `no case draws "${l}"`);
  const ball = G.cases.find((c) => c.sil === 'ball')!;
  assert.ok(typeof ball.skirt !== 'string' && ball.skirt.every((p) => p.style.length === 0), 'the ball gown’s circle skirt got a hem line');
  const fronts = G.cases.flatMap((c) => (typeof c.bodice === 'string' ? [] : c.bodice.filter((p) => p.name === 'Bodice front').flatMap((p) => p.style.map((s) => s.pts.length))));
  assert.ok(fronts.includes(18) && fronts.includes(19), `both shoulder branches are not covered: ${fronts}`);
});

test('1b · no lines, no change: an order without lines draws the blocks exactly as before', () => {
  const { bodice, skirt } = drawn('aline', null);
  assert.ok(bodice.ok && skirt.ok);
  if (bodice.ok && skirt.ok) for (const p of [...bodice.pieces, ...skirt.pieces]) assert.equal(p.style, undefined);
});

test('2 · what the maker sends is checked, and refused rather than thinned', () => {
  const ok = G.cases[1]!.lines;
  assert.deepEqual(sanitizeGownOrderLines(ok), ok);
  assert.deepEqual(sanitizeGownOrderLines({}), {});
  for (const bad of [
    null,
    [],
    { neck: { ...ok.neck, centre: '17.5' } },
    { neck: { ...ok.neck, from: '<b>x</b>' } },
    { back: { ...ok.back, depth: 1e6 } },
    { hem: { ...ok.hem, edge: 'zigzag' } },
    { hem: { ...ok.hem, custom: 'yes' } },
    { armhole: -1 },
    { neck: ok.neck, price: 1 },
  ]) assert.equal(sanitizeGownOrderLines(bad), null, `took ${JSON.stringify(bad)?.slice(0, 60)}`);
  // Only the named keys come back (a stray key inside a part is dropped with the part's own check).
  const extra = sanitizeGownOrderLines({ neck: { ...ok.neck, note: 'x' } });
  assert.ok(extra && !('note' in (extra.neck as object)));
});

test('3 · the lines are drawn in rust, dash-dot and labelled; on the pages too; never a price', () => {
  const { bodice } = drawn('aline', G.cases[0]!.lines);
  assert.ok(bodice.ok);
  if (!bodice.ok) return;
  const front = bodice.pieces[1]!;
  const ops = gownPieceDraw(front, gownPieceGeom(front, { seam: 1.5, hem: 2.5, zip: 2, neck: 1 }, false), 0, 0);
  const line = ops.find((o) => o.k === 'path' && o.dash && o.dash.length === 4);
  assert.ok(line && line.k === 'path' && line.stroke === GOWN_PAT_INK.rust, 'the design line is not a rust dash-dot');
  assert.ok(ops.some((o) => o.k === 'text' && o.text === 'design neckline (custom)'), 'the design line has no label');
  const svg = gownBlocksSvg(bodice.pieces, 'Bodice blocks', { seam: 1.5, hem: 2.5, zip: 2, neck: 1 }, false);
  assert.match(svg, /stroke-dasharray="[\d.]+ [\d.]+ [\d.]+ [\d.]+"/, 'the sheet drops the dash-dot');
  assert.match(svg, />design neckline \(custom\)</);
  assert.doesNotMatch(svg, /₱|PHP|centavo/i);
});
