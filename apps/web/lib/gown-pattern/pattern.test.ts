/**
 * 👗 THE CUTTING BLOCKS DRAW WHAT THE PROTOTYPE DREW — plan step B6 (corpus WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 5).
 *
 *   1 · Golden: the port's 28 skirt drafts (7 bodies × 4 silhouettes) and 7 bodice drafts equal the prototype's own
 *       outputs on the same inputs, to the micron (prototype-v197.golden.json, made by running gown_maker_v197.html's
 *       draftSkirt / draftBodice — scripts/gown-pattern-golden.mjs).
 *   2 · Every check of every draft is within 2.5 mm.
 *   3 · Impossible input says why ("Can't draft: check waist to hip."), never a half-drawn block.
 *   4 · The order of trust: tape → typed → estimate; any estimate marks the draft (the sheet prints "ESTIMATE: measure
 *       before cutting").
 *   5 · The printed constants table is the prototype's DRAFT, and the drafting code reads the same numbers.
 *   6 · The sheet: one outline per piece, in mm, one ink, no price anywhere in lib/gown-pattern.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-pattern/pattern.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import golden from './prototype-v197.golden.json';
import { draftSkirt, type GownBlockPiece } from './skirt';
import { draftBodice } from './bodice';
import { gownBlocksSvg } from './svg';
import { gownDraftInputs, type GownDraftOrder } from './inputs';
import { GOWN_DRAFT, GOWN_DRAFT_ESTIMATE, GOWN_DRAFT_TABLE, GOWN_DRAFT_TOLERANCE_CM } from './draft-constants';
import type { GownMeasures } from '../gown-config';

type GoldenInput = {
  vals: Record<string, number>;
  sil?: string;
  designV?: number;
  hem?: string;
  estimate?: Record<string, number>;
  typed?: Record<string, number>;
  tape?: Record<string, number>;
  ease: { part: string; ease: number }[];
};

function orderOf(g: GoldenInput): GownDraftOrder {
  const measures: GownMeasures = {};
  for (const [k, cm] of Object.entries(g.estimate ?? {})) (measures as Record<string, unknown>)[k] = { cm, from: 'estimate' };
  for (const [k, cm] of Object.entries(g.typed ?? {})) (measures as Record<string, unknown>)[k] = { cm, from: 'typed' };
  return {
    vals: g.vals,
    sil: (g.sil ?? 'aline') as GownDraftOrder['sil'],
    ...(g.designV !== undefined ? { designV: g.designV } : {}),
    hem: (g.hem ?? 'floor') as GownDraftOrder['hem'],
    measures,
    ease: g.ease.map((r) => ({ part: r.part, body: 1, ease: r.ease, gown: 0 })),
  };
}

const EPS = 1e-9;
function near(a: unknown, b: unknown, path: string): void {
  if (typeof a === 'number' && typeof b === 'number') {
    assert.ok(Math.abs(a - b) <= EPS, `${path}: port ${a} ≠ prototype ${b}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    assert.equal(a.length, b.length, `${path}: length ${a.length} ≠ ${b.length}`);
    a.forEach((x, i) => near(x, b[i], `${path}[${i}]`));
    return;
  }
  assert.deepEqual(a, b, path);
}

/** The prototype's piece, mapped to the port's shape (the prototype has no `points` on skirt pieces and no `vent` on bodice ones). */
function samePiece(port: GownBlockPiece, proto: Record<string, unknown>, path: string) {
  assert.equal(port.name, proto.name, `${path}.name`);
  assert.equal(port.cut, proto.cut, `${path}.cut`);
  near(port.outline, proto.outline, `${path}.outline`);
  near(port.grain, proto.grain, `${path}.grain`);
  near(port.marks, proto.marks, `${path}.marks`);
  near(port.points, proto.points ?? [], `${path}.points`);
  near(port.vent, proto.vent ?? 0, `${path}.vent`);
  const darts = (proto.darts as Record<string, unknown>[]).map((d) => ('a' in d ? { a: d.a, apex: d.apex, b: d.b } : { x: d.x, w: d.w, len: d.len }));
  near(port.darts.map((d) => ('a' in d ? [d.a, d.apex, d.b] : [d.x, d.w, d.len])), darts.map((d) => ('a' in d ? [d.a, d.apex, d.b] : [d.x, d.w, d.len])), `${path}.darts`);
}

const G = golden as unknown as {
  skirts: { input: GoldenInput; result: Record<string, unknown> }[];
  bodices: { input: GoldenInput; result: Record<string, unknown> }[];
  errors: { case: string; input: GoldenInput; result: { error: string } }[];
  sources: { input: GoldenInput; result: Record<string, unknown> };
  knee: { input: GoldenInput; result: Record<string, unknown> };
  oldAline: { input: GoldenInput; result: Record<string, unknown> };
  draft: string[][];
};

test('the golden file holds the prototype’s 42 skirts and 7 bodices', () => {
  assert.equal(G.skirts.length, 42);
  assert.equal(G.bodices.length, 7);
  assert.equal(new Set(G.skirts.map((s) => s.input.sil)).size, 6);
});

test('1 · 42 skirt drafts equal the prototype’s, to the micron', () => {
  for (const [i, s] of G.skirts.entries()) {
    const d = draftSkirt(orderOf(s.input));
    assert.ok(d.ok, `skirt ${i}: refused ${!d.ok && d.error}`);
    if (!d.ok) continue;
    const p = s.result as { pieces: Record<string, unknown>[]; checks: unknown[]; src: unknown; est: boolean; note: string };
    assert.equal(d.pieces.length, p.pieces.length, `skirt ${i}: piece count`);
    d.pieces.forEach((pc, j) => samePiece(pc, p.pieces[j]!, `skirt ${i} piece ${j}`));
    near(d.checks, p.checks, `skirt ${i}.checks`);
    assert.deepEqual(d.src, p.src);
    assert.equal(d.est, p.est);
    assert.equal(d.note, p.note);
  }
});

test('1 · 7 bodice drafts equal the prototype’s, to the micron', () => {
  for (const [i, s] of G.bodices.entries()) {
    const d = draftBodice(orderOf(s.input));
    assert.ok(d.ok, `bodice ${i}: refused ${!d.ok && d.error}`);
    if (!d.ok) continue;
    const p = s.result as { pieces: Record<string, unknown>[]; checks: unknown[]; src: unknown; est: boolean; bustDart: number; AD: number };
    d.pieces.forEach((pc, j) => samePiece(pc, p.pieces[j]!, `bodice ${i} piece ${j}`));
    near(d.checks, p.checks, `bodice ${i}.checks`);
    assert.deepEqual(d.src, p.src);
    assert.equal(d.est, p.est);
    near(d.bustDart, p.bustDart, `bodice ${i}.bustDart`);
    near(d.AD, p.AD, `bodice ${i}.AD`);
  }
});

test('2 · every check of the 42 skirts and 7 bodices is within 2.5 mm', () => {
  const off: string[] = [];
  for (const s of G.skirts) {
    const d = draftSkirt(orderOf(s.input));
    if (!d.ok) off.push(`${s.input.sil} refused`);
    else for (const [n, a, b] of d.checks) if (Math.abs(a - b) > GOWN_DRAFT_TOLERANCE_CM) off.push(`${s.input.vals.height}/${s.input.vals.waist}/${s.input.vals.hips} ${s.input.sil}: ${n}`);
  }
  for (const s of G.bodices) {
    const d = draftBodice(orderOf(s.input));
    if (!d.ok) off.push(`bodice ${s.input.vals.bust} refused`);
    else for (const [n, a, b] of d.checks) if (Math.abs(a - b) > GOWN_DRAFT_TOLERANCE_CM) off.push(`bodice ${s.input.vals.bust}: ${n}`);
  }
  assert.deepEqual(off, []);
  // Aldrich size 12 (160 cm, bust 88): armscye depth 21.5 (book 21).
  const size12 = draftBodice(orderOf(G.bodices[2]!.input));
  assert.ok(size12.ok && Math.abs(size12.AD - 21.5) < 0.05, 'size 12 armscye depth moved');
});

test('3 · impossible input says why, as the prototype does', () => {
  for (const e of G.errors) {
    const d = e.case.startsWith('bodice') ? draftBodice(orderOf(e.input)) : draftSkirt(orderOf(e.input));
    assert.ok(!d.ok, `${e.case}: drew a block`);
    if (!d.ok) assert.equal(d.error, e.result.error, e.case);
  }
  assert.equal((draftSkirt(orderOf(G.errors[0]!.input)) as { error: string }).error, "Can't draft: check waist to hip.");
});

test('4 · tape beats typed beats estimate, and an estimate marks the draft', () => {
  const s = G.sources;
  const order = orderOf(s.input);
  const d = draftSkirt(order, s.input.tape as never);
  assert.ok(d.ok);
  if (d.ok) {
    assert.deepEqual(d.src, s.result.src);
    assert.deepEqual(d.src, { waist: 'body', hips: 'body', waistHip: 'typed', length: 'tape' });
    assert.equal(d.est, false, 'no estimate was used, yet the draft is marked');
    near(d.checks, s.result.checks, 'sources.checks');
  }
  const estimated = draftSkirt(orderOf(G.skirts[0]!.input));
  assert.ok(estimated.ok && estimated.est, 'a draft from estimates is not marked');
  assert.match(GOWN_DRAFT_ESTIMATE, /^ESTIMATE: measure before cutting/);
  // Knee length reads waist to hem, not waist to floor.
  const k = draftSkirt(orderOf(G.knee.input));
  assert.ok(k.ok);
  if (k.ok) near(k.checks, G.knee.result.checks, 'knee.checks');
  // Every number tagged with where it came from.
  const inputs = gownDraftInputs(order, s.input.tape as never);
  assert.deepEqual(inputs.waistFloor, { value: 100, source: 'tape' });
  assert.deepEqual(inputs.waistHip, { value: 22, source: 'typed' });
  assert.equal(inputs.knee?.source, 'estimate');
  assert.deepEqual(inputs.bust, { value: s.input.vals.bust, source: 'body' });
  assert.equal(inputs.neck, null);
});

test('4b · the Filipiniana saya drafts as the A-line', () => {
  const a = draftSkirt(orderOf(G.skirts[6]!.input));
  const t = draftSkirt({ ...orderOf(G.skirts[6]!.input), sil: 'terno' });
  assert.equal(G.skirts[6]!.input.sil, 'aline');
  assert.ok(a.ok && t.ok);
  if (a.ok && t.ok) near(t.pieces.map((p) => p.outline), a.pieces.map((p) => p.outline), 'terno');
});

test('4c · v197: the A-line runs straight past the hip to a hem about 3 × hips; the old A-line is Fit and flare', () => {
  for (const s of G.skirts.filter((x) => x.input.sil === 'aline' || x.input.sil === 'terno')) {
    const d = draftSkirt(orderOf(s.input));
    assert.ok(d.ok);
    if (!d.ok) continue;
    const hem = d.checks.find((c) => c[0].startsWith('Hem round'));
    assert.ok(hem, 'an A-line has no hem-round check');
    assert.ok(Math.abs(hem![2] - hem![1]) <= GOWN_DRAFT_TOLERANCE_CM, `hem round ${hem![2]} is not about 3 × hips ${hem![1]}`);
    const hip = d.checks.find((c) => c[0].startsWith('Hip line'));
    assert.equal(hip![1], (s.input.vals.hips ?? 0) + 10, 'the A-line hip ease is not 10 cm');
  }
  const f = draftSkirt(orderOf(G.skirts.find((x) => x.input.sil === 'fitflare')!.input));
  assert.ok(f.ok && !f.checks.some((c) => c[0].startsWith('Hem round')) && /Fit and flare/.test(f.note));
  // An A-line saved before v197 opens as Fit and flare, blocks included.
  const old = draftSkirt(orderOf(G.oldAline.input));
  assert.ok(old.ok && old.sil === 'fitflare', 'an old A-line did not open as Fit and flare');
  if (old.ok) near(old.pieces.map((p) => p.outline), (G.oldAline.result as { pieces: { outline: unknown }[] }).pieces.map((p) => p.outline), 'oldAline');
  // A design with no version (none is stored before this port) drafts as what it says.
  const now = draftSkirt({ ...orderOf(G.oldAline.input), designV: undefined });
  assert.ok(now.ok && now.sil === 'aline');
});

test('5 · the printed constants are the prototype’s DRAFT, and the code reads them', () => {
  assert.deepEqual(GOWN_DRAFT_TABLE.map((r) => [...r]), G.draft);
  const bodice = readFileSync(join(__dirname, 'bodice.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  for (const k of Object.keys(GOWN_DRAFT)) assert.match(bodice, new RegExp(`K\\.${k}\\b`), `bodice.ts does not read GOWN_DRAFT.${k}`);
});

test('6 · the sheet: one outline per piece, in mm, one ink; no price in the pattern engine', () => {
  const d = draftSkirt(orderOf(G.skirts[1]!.input));
  assert.ok(d.ok);
  if (!d.ok) return;
  const svg = gownBlocksSvg(d.pieces, 'Skirt blocks');
  assert.equal(svg.match(/<polygon /g)?.length, d.pieces.length);
  assert.match(svg, /width="[\d.]+mm" height="[\d.]+mm"/);
  assert.doesNotMatch(svg, /#[0-9a-f]{3,6}\b/i, 'the sheet carries a typed colour');
  assert.match(svg, /Skirt front/);
  for (const f of readdirSync(__dirname).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'))) {
    const src = readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    assert.doesNotMatch(src, /price|centavos|₱|php\.ts|formatPhp/i, `${f} mentions money; the blocks never carry a price`);
  }
});
