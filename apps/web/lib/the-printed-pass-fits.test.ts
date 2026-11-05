/**
 * lib/the-printed-pass-fits.test.ts — THE PRINTED EVENT PASS: NOTHING
 * OVERLAPS, NOTHING LEAVES THE SAFE LINE, EVERYTHING READS.
 *
 * Owner 2026-10-16, looking at the printables "EVENT PASS SIZE" picker
 * (Calling card · ID card (CR80) · Train ticket · Boarding pass · Phone card):
 * *"check the alignment of the names and elements on the print. make sure
 * nothing overlaps, make everything legible"* — and the same day, on his own
 * Classic phone card: "SCANS ONCE AT THE DOOR" printed ON the inner frame's
 * bottom stroke ("a text overlaps on lines").
 *
 * Measured before the fix, on these rows (`printed-pass-stress.fixture.ts`):
 * a 22-letter name already ran off a calling card's stub, across the tear line
 * (`text`'s 0.55 floor, then drawn anyway); labels were set at 4.8–5.8 pt; a
 * long venue was stacked onto the line above it; "As of <date>" sat on the
 * DATE · ARRIVE row; a long table name on the Poster card was 3.4 pt; Classic's
 * gold read 2.55 : 1 on its paper, white names on a light still 1.3 : 1.
 *
 * Every pass format × every ticket style (Classic, Modern, Cyber Neon, Rustic as
 * a sample) × every Digital-ticket design × the hardest rows × with and
 * without a long couple, a logo, an NFC spot, a round code, the Setnayan mark
 * — drawn by the SHIPPED layout (`layoutPasses`, the route's own call) and
 * measured on the ops the PDF backend draws (`lib/print-fit-measure.ts`).
 *
 * (`node:test` via tsx, like every lib test here — `pnpm test:unit` runs it.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { INVITE_THEMES } from './invite-themes';
import { PASS_CARD_DESIGNS } from './pass-card';
import { PRINT_FORMATS, printLookFor, type PrintFormatId } from './print-pieces';
import { PRINT_MIN_BODY_PT, SAFE_PT, fitWords, layoutPassCard, layoutPasses, type PrintDoc, type PrintOp } from './print-layout';
import { LEGIBLE_FLOOR_PT, NAME_FLOOR_PT, elementsOf, measurePass, pathBounds, strokesOf } from './print-fit-measure';
import { STRESS_ROWS, STRESS_THEMES, stressEvent } from './printed-pass-stress.fixture';

const VARIANTS = [
  { long: false, logo: false, nfc: false, round: false, mark: true },
  { long: true, logo: true, nfc: true, round: true, mark: false },
  { long: true, logo: false, nfc: false, round: false, mark: true },
  { long: false, logo: true, nfc: true, round: false, mark: false },
];
const PASS_FORMATS = Object.values(PRINT_FORMATS)
  .filter((f) => f.for === 'pass')
  .map((f) => f.id) as PrintFormatId[];

function* everyPass(): Generator<{ where: string; doc: PrintDoc; theme: (typeof STRESS_THEMES)[number]['theme']; name: string }> {
  for (const fmt of PASS_FORMATS) {
    const designs = PRINT_FORMATS[fmt].style === 'phone' ? [...PASS_CARD_DESIGNS] : [null];
    for (const { theme, mode } of STRESS_THEMES) {
      const look = printLookFor(theme);
      for (const design of designs) {
        for (const [vi, v] of VARIANTS.entries()) {
          const data = stressEvent({ ...v, still: Boolean(INVITE_THEMES[theme].media) });
          if (design) data.details = { ...data.details, passDesign: design };
          for (const r of STRESS_ROWS) {
            const doc = layoutPasses({ look, data, mode, foil: false, format: fmt }, [r.pass])[0]!;
            yield { where: `${fmt} · ${theme} · ${design ?? '—'} · v${vi} · ${r.key}`, doc, theme, name: r.pass.name };
          }
        }
      }
    }
  }
}

test('EVERY pass format × style × hard guest: no overlap, inside the safe line, ≥ floor, never cut silently, ≥ 4.5 : 1', () => {
  const problems: string[] = [];
  let n = 0;
  for (const { where, doc, theme, name } of everyPass()) {
    n += 1;
    for (const p of measurePass(doc, printLookFor(theme), name)) problems.push(`${where} · ${p.rule}: ${p.detail}`);
  }
  assert.ok(n >= 800, `only ${n} passes were drawn — the sweep did not run`);
  const byRule = new Map<string, number>();
  for (const p of problems) {
    const rule = /· (\w+): /.exec(p)?.[1] ?? '?';
    byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
  }
  assert.deepEqual(problems.slice(0, 20), [], `${problems.length} problems on the printed pass — ${[...byRule].map(([k, v]) => `${k}: ${v}`).join(' | ')}`);
});

test('the floors are the print floors: 6 pt for every word, 8 pt for the guest’s name', () => {
  assert.equal(LEGIBLE_FLOOR_PT, PRINT_MIN_BODY_PT, 'one secondary floor for every print');
  assert.equal(NAME_FLOOR_PT, 8);
});

test('the owner’s case: the door line on a Classic phone card sits INSIDE the frame — the PDF and the saved PNG alike', () => {
  const row = STRESS_ROWS.find((r) => r.key === 'caption-vs-frame')!;
  for (const mark of [true, false]) {
    for (const mode of ['print', 'screen'] as const) {
      const data = stressEvent({ long: false, logo: false, still: false, nfc: false, round: false, mark });
      const look = printLookFor('house');
      const docs = [
        layoutPasses({ look, data: { ...data, details: { ...data.details, passDesign: 'classic' } }, mode, foil: false, format: 'phone-card' }, [row.pass])[0]!,
        layoutPassCard({ look, data, mode, foil: false }, row.pass, 'classic'), // the Digital ticket PNG's drawing
      ];
      for (const doc of docs) {
        const frame = doc.ops.find((o): o is Extract<PrintOp, { t: 'path' }> => o.t === 'path' && !!o.stroke && !o.fill)!;
        assert.ok(frame, 'the Classic ticket has its inner frame');
        const frameTop = pathBounds(frame.d)!.y + pathBounds(frame.d)!.h - (frame.sw ?? 0.5) / 2;
        const door = doc.ops.find((o) => o.t === 'path' && o.text?.s.startsWith('SCANS ONCE'));
        assert.ok(door && door.t === 'path', 'the door line is drawn');
        const ink = pathBounds(door.d)!;
        assert.ok(ink.y + ink.h < frameTop - 2, `mark=${mark} ${mode}: the door line's ink ends at ${(ink.y + ink.h).toFixed(1)}, the frame's stroke starts at ${frameTop.toFixed(1)}`);
        // the DATE · ARRIVE row (label over value, two lines) sits above the door line, clear of it
        const arrive = doc.ops.find((o) => o.t === 'path' && o.text?.s === row.pass.arrive);
        assert.ok(arrive && arrive.t === 'path', 'the Arrive value is drawn');
        assert.ok(pathBounds(arrive.d)!.y + pathBounds(arrive.d)!.h < ink.y, 'the Arrive value ends above the door line');
        assert.deepEqual(measurePass(doc, look, row.pass.name), [], 'and the whole card measures clean');
      }
    }
  }
});

test('the measurement is not vacuous — it catches type on a frame, type on type, type past the safe line, and tiny type', () => {
  const look = printLookFor('house');
  const base: PrintDoc = { piece: 'pass', w: 255, h: 340, bleed: 0, die: 'rect', diePath: '', ops: [{ t: 'rect', x: 0, y: 0, w: 255, h: 340, fill: look.paper }] };
  const line = (s: string, x: number, y: number, w: number, h: number, size = 9): PrintOp => ({
    t: 'path',
    d: `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}Z`,
    fill: '#000000',
    text: { s, size, asked: size, width: w },
  });
  const frame: PrintOp = { t: 'path', d: 'M15 15L240 15L240 325L15 325Z', stroke: look.accent, sw: 0.7 };
  const doc = { ...base, ops: [...base.ops, frame, line('ON THE FRAME', 30, 321, 80, 6), line('A', 30, 100, 40, 8), line('B', 50, 104, 40, 8), line('OFF', 2, 200, 30, 6), line('tiny', 100, 200, 20, 4, 4)] };
  const rules = new Set(measurePass(doc, look, null).map((p) => p.rule));
  for (const r of ['hairline', 'overlap', 'safe', 'floor'] as const) assert.ok(rules.has(r), `the measurement reports ${r}`);
  assert.equal(strokesOf(doc).length, 4, 'a stroked frame is four edges');
  assert.equal(elementsOf(doc).filter((e) => e.kind === 'text').length, 5);
  void SAFE_PT;
});

test('a name that does not fit: shrink to the floor, then two lines, then "…" — never wider than its room', () => {
  const name = 'Ma. Concepcion Dela Cruz-Villanueva y Santos';
  const one = fitWords('Teodora Liwanag', { font: 'cormorant', size: 10.5, maxWidth: 200, floor: 8 });
  assert.deepEqual(one, { lines: ['Teodora Liwanag'], size: 10.5 }, 'room enough: as asked');
  const shrunk = fitWords('Rosalinda Buenaventura', { font: 'cormorant', size: 10.5, maxWidth: 80, floor: 8, maxLines: 2 });
  assert.equal(shrunk.lines.length, 1, 'a little long: shrunk, one line');
  assert.ok(shrunk.size >= 8 && shrunk.size < 10.5);
  const two = fitWords(name, { font: 'cormorant', size: 10.5, maxWidth: 110, floor: 8, maxLines: 2 });
  assert.equal(two.lines.length, 2, 'long: two lines');
  assert.equal(two.lines.join(' '), name, 'two lines carry the whole name');
  const cut = fitWords(name, { font: 'cormorant', size: 10.5, maxWidth: 62, floor: 8, maxLines: 2 });
  assert.equal(cut.size, 8, 'too long for two lines: at the floor');
  assert.ok(cut.lines[1]!.endsWith('…'), 'and the cut says so');
  const word = fitWords('Wolfeschlegelsteinhausenbergerdorff', { font: 'cormorant', size: 10.5, maxWidth: 62, floor: 8, maxLines: 2 });
  assert.ok(word.lines.length === 1 && word.lines[0]!.endsWith('…'), 'one unbreakable word: cut with an ellipsis, not overflowed');
});
