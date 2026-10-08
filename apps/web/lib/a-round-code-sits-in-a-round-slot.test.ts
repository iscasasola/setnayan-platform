/**
 * lib/a-round-code-sits-in-a-round-slot.test.ts — A ROUND CODE NEVER SITS IN A
 * SQUARE FRAME.
 *
 * Owner 2026-09-30, verbatim: *"Custom QR when shape is changed the slot for
 * the QR should also be round on the prints if the QR is round and not have a
 * square frame with round QR"*.
 *
 * Every print draws its code's white plate through ONE helper,
 * `qrPlate` (lib/print-layout.ts), which follows the event's `QrLook.shape`
 * (carried on the set as `PrintSetData.qrShape`). This file holds that on the
 * SHAPES a surface actually draws — the layout ops both backends paint, and
 * the SVG the screen and the saved PNG are made from — never on a flag:
 *
 *   · Circle → no rectangle HUGS the code (contains it and reaches no more
 *     than half the code's side past it on every side: a frame), and the
 *     code's disc lies inside a round slot drawn before it;
 *   · Square → exactly as before: a hugging square plate, no round one;
 *   · a round code DECODES where it sits — in every Digital ticket design (the
 *     PNG a guest saves) and on a printed card whose paper is dark.
 *
 * Surfaces swept: every print-set piece × every format × every theme (the
 * corner QR, the Finer Details' hub code, the poster's panel, the Printed
 * ticket's stub in every style), every Digital ticket design, and the free
 * QR sheet's cut line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { INVITE_THEME_IDS } from './invite-themes';
import { PRINT_FORMATS, PRINT_SET_KEYS, formatFamilyOf, printLookFor, type PrintSetKey } from './print-pieces';
import { PASS_CARD_DESIGNS } from './pass-card';
import {
  layoutPassCard,
  layoutPasses,
  layoutPieceDocs,
  layoutQrCodes,
  safeContainsBox,
  type PrintDoc,
  type PrintOp,
  type PrintPass,
  type PrintSetData,
} from './print-layout';
import { renderPrintSvg } from './print-render-svg';
import { renderPassCardPng } from './pass-card-render';
import { renderEventLandingQrPng, renderInvitationQrPng } from './qr';
import { decodeQrPayloadFromImage } from './qr-decode';
import { QR_CREAM, QR_INK, type QrLook, type QrShape } from './qr-look';
import { styledQrSvg } from './qr-style-svg';
import { stripComments } from './strip-comments';

function data(qrShape: QrShape | undefined, over: Partial<PrintSetData> = {}): PrintSetData {
  return {
    names: { first: 'Indalecio', second: 'Claire' },
    eyebrow: 'The wedding of',
    eventWord: 'Wedding',
    dateLabel: 'Friday · December 18, 2026',
    ceremonyTime: '2:00 PM',
    ceremonyVenue: 'San Agustin Church',
    receptionTime: '6:00 PM',
    receptionVenue: 'The Manila Hotel',
    monogram: null,
    initials: 'I & C',
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [], setnayanMark: false, nfc: false },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: 'setnayan.com/indalecio-and-claire',
    hasStill: false,
    hasEventQr: true,
    qrShape,
    ...over,
  };
}
const PASS: PrintPass = { name: 'Maria Santos', seat: 'Table 7', qrRef: 'qr-g-1', serial: 'Nº 0001', arrive: '3:30 PM', party: 1 };

type Box = { x: number; y: number; w: number; h: number };
type Img = Extract<PrintOp, { t: 'image' }>;
const isCode = (o: PrintOp): o is Img => o.t === 'image' && (o.ref === 'eventqr' || o.ref.startsWith('qr-'));

/** A rectangle that HUGS a code: contains it and reaches ≤ half its side past it on every side. */
function hugs(r: Box, q: Box): boolean {
  const e = 0.01;
  const reach = q.w / 2;
  const left = q.x - r.x;
  const top = q.y - r.y;
  const right = r.x + r.w - (q.x + q.w);
  const bottom = r.y + r.h - (q.y + q.h);
  return [left, top, right, bottom].every((d) => d >= -e && d <= reach + e);
}

/** A circle whose disc holds the code's own disc (the round code fills its image box). */
function holdsDisc(c: { cx: number; cy: number; r: number }, q: Box): boolean {
  const dx = c.cx - (q.x + q.w / 2);
  const dy = c.cy - (q.y + q.h / 2);
  return Math.hypot(dx, dy) + q.w / 2 <= c.r + 0.01;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The rectangular FRAME round a code, if it has one: every rectangle drawn
 * before it that overlaps it and lies within half the code's side of it,
 * joined — a plate is one rect, the Digital ticket's rounded tile is two (plus
 * corner discs), and both are a square frame. Null when their union does not
 * hug the code.
 */
function rectFrame(ops: readonly PrintOp[], q: Box): Box | null {
  const zone = { x: q.x - q.w / 2 - 0.01, y: q.y - q.h / 2 - 0.01, w: q.w * 2 + 0.02, h: q.h * 2 + 0.02 };
  const inZone = (r: Box) => r.x >= zone.x && r.y >= zone.y && r.x + r.w <= zone.x + zone.w && r.y + r.h <= zone.y + zone.h;
  const parts = ops.filter((p): p is Extract<PrintOp, { t: 'rect' }> => p.t === 'rect' && overlaps(p, q) && inZone(p));
  if (!parts.length) return null;
  const x = Math.min(...parts.map((p) => p.x));
  const y = Math.min(...parts.map((p) => p.y));
  const u = { x, y, w: Math.max(...parts.map((p) => p.x + p.w)) - x, h: Math.max(...parts.map((p) => p.y + p.h)) - y };
  return hugs(u, q) ? u : null;
}

/** What is wrong with the slot of every code on one doc, for a given shape. */
function slotProblems(doc: PrintDoc, shape: QrShape, where: string): { problems: string[]; codes: number } {
  const out: string[] = [];
  let codes = 0;
  doc.ops.forEach((o, i) => {
    if (!isCode(o)) return;
    codes += 1;
    const before = doc.ops.slice(0, i);
    const frame = rectFrame(before, o);
    const frames = frame ? [frame] : [];
    const rings = before.filter((p): p is Extract<PrintOp, { t: 'circle' }> => p.t === 'circle' && holdsDisc(p, o));
    if (shape === 'circle') {
      if (frames.length) out.push(`${where}: a rectangle frames the round code ${o.ref}`);
      if (!rings.length) out.push(`${where}: the round code ${o.ref} has no round slot`);
    } else {
      if (!frames.length) out.push(`${where}: the square code ${o.ref} lost its square plate`);
      if (rings.length) out.push(`${where}: the square code ${o.ref} sits in a round slot`);
    }
  });
  return { problems: out, codes };
}

function formatsOf(piece: PrintSetKey): Array<string | null> {
  const family = formatFamilyOf(piece);
  return family ? Object.values(PRINT_FORMATS).filter((f) => f.for === family).map((f) => f.id) : [null];
}

/** Every doc a couple can print or save, drawn for one shape. */
function everySurface(shape: QrShape | undefined): Array<{ where: string; doc: PrintDoc }> {
  const out: Array<{ where: string; doc: PrintDoc }> = [];
  for (const theme of INVITE_THEME_IDS) {
    const look = printLookFor(theme);
    for (const nfc of [false, true]) {
      const d = data(shape, { details: { ...data(shape).details, nfc } });
      for (const piece of PRINT_SET_KEYS) {
        for (const format of formatsOf(piece)) {
          layoutPieceDocs(piece, { look, data: d, mode: 'print', foil: false, format, pass: PASS }).forEach((doc, i) =>
            out.push({ where: `${theme} · ${piece} · ${format ?? 'default'}${nfc ? ' · nfc' : ''} · side ${i + 1}`, doc }),
          );
        }
      }
      for (const format of formatsOf('pass')) {
        for (const doc of layoutPasses({ look, data: d, mode: 'print', foil: false, format }, [PASS])) out.push({ where: `${theme} · printed ticket · ${format}`, doc });
      }
      for (const design of PASS_CARD_DESIGNS) {
        out.push({ where: `${theme} · digital ticket · ${design}`, doc: layoutPassCard({ look, data: d, mode: 'screen', foil: false }, PASS, design) });
      }
    }
  }
  const cells = Array.from({ length: 14 }, (_, i) => ({ name: `Guest Number ${i + 1} Villaseñor-Castañeda`, sub: i % 2 ? 'Table 3' : null, qrRef: `qr-${i}` }));
  layoutQrCodes('Indalecio & Claire', cells, shape).forEach((doc, i) => out.push({ where: `qr sheet · page ${i + 1}`, doc }));
  return out;
}

test('CIRCLE: on every surface, no rectangle frames the round code — and a round slot holds it', () => {
  const problems: string[] = [];
  let codes = 0;
  for (const { where, doc } of everySurface('circle')) {
    const r = slotProblems(doc, 'circle', where);
    problems.push(...r.problems);
    codes += r.codes;
  }
  assert.ok(codes >= 500, `only ${codes} codes were found — the sweep did not reach the surfaces`);
  assert.deepEqual(problems.slice(0, 20), [], `${problems.length} codes sit in the wrong slot`);
});

test('SQUARE: every surface keeps its square plate, exactly as before — no round slot appears', () => {
  const problems: string[] = [];
  for (const shape of ['square', undefined] as const) {
    // `undefined` = a set that never resolved a look: it must draw what it always drew.
    for (const { where, doc } of everySurface(shape).filter((s) => !s.where.startsWith('qr sheet'))) {
      problems.push(...slotProblems(doc, 'square', where).problems);
    }
  }
  // The free QR sheet has a dashed CUT LINE round each cell (name included), never a round one on a square code.
  for (const doc of layoutQrCodes('I & C', [{ name: 'Maria', sub: null, qrRef: 'qr-1' }])) {
    assert.equal(doc.ops.filter((o) => o.t === 'circle').length, 0, 'the square sheet draws no round cut line');
  }
  assert.deepEqual(problems.slice(0, 20), []);
});

test('an event that never resolved a look (no qrShape) draws the square plate it always drew', () => {
  const look = printLookFor('house');
  const bare = layoutPieceDocs('details', { look, data: data(undefined), mode: 'print', foil: false });
  const square = layoutPieceDocs('details', { look, data: data('square'), mode: 'print', foil: false });
  assert.deepEqual(bare.map((d) => d.ops), square.map((d) => d.ops));
});

test('CIRCLE: every Digital ticket still fits — the Poster’s facts, off their tile, stay inside the safe line and off the code', () => {
  const bad: string[] = [];
  for (const theme of INVITE_THEME_IDS) {
    for (const design of PASS_CARD_DESIGNS) {
      const doc = layoutPassCard({ look: printLookFor(theme), data: data('circle'), mode: 'print', foil: false }, PASS, design);
      const code = doc.ops.find(isCode)!;
      for (const o of doc.ops) {
        if (o.t === 'image' && o.ref === 'still') continue;
        if (o.t === 'rect' && (o.x <= 0.01 || o.y <= 0.01 || o.x + o.w >= doc.w - 0.01 || o.y + o.h >= doc.h - 0.01)) continue;
        if (o.t !== 'path') continue;
        const n = (o.d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
        const xs = n.filter((_, i) => i % 2 === 0);
        const ys = n.filter((_, i) => i % 2 === 1);
        const b = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
        if (!safeContainsBox(doc.die, doc.w, doc.h, b)) bad.push(`${theme} · ${design}: ink leaves the safe area`);
        // Ink may not enter the round slot (the code's disc plus its white ring).
        const cx = code.x + code.w / 2;
        const cy = code.y + code.h / 2;
        const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
        const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
        if (o.fill && Math.hypot(nx - cx, ny - cy) < code.w / 2) bad.push(`${theme} · ${design}: ink touches the round code`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

// ── The rendered shapes (what the screen, the PNG and the sample are made of) ──

/** `<rect>`s, `<circle>`s and `<image>`s of a rendered print SVG — clip paths excluded (they paint nothing). */
function renderedShapes(svg: string) {
  const painted = svg.replace(/<clipPath\b[\s\S]*?<\/clipPath>/g, '');
  const attr = (tag: string, name: string) => Number(new RegExp(`\\s${name}="(-?[\\d.]+)"`).exec(tag)?.[1] ?? NaN);
  const rects = [...painted.matchAll(/<rect\b[^>]*>/g)].map((m) => ({ t: 'rect' as const, x: attr(m[0], 'x'), y: attr(m[0], 'y'), w: attr(m[0], 'width'), h: attr(m[0], 'height') }));
  const circles = [...painted.matchAll(/<circle\b[^>]*>/g)].map((m) => ({ cx: attr(m[0], 'cx'), cy: attr(m[0], 'cy'), r: attr(m[0], 'r') }));
  const images = [...painted.matchAll(/<image\b[^>]*>/g)].map((m) => ({ x: attr(m[0], 'x'), y: attr(m[0], 'y'), w: attr(m[0], 'width'), h: attr(m[0], 'height') }));
  return { rects, circles, images };
}

test('the RENDERED SVG of a round-code ticket and card: no rectangle hugs the code, a circle holds it', () => {
  const look = printLookFor('house');
  const docs = [
    ...PASS_CARD_DESIGNS.map((design) => layoutPassCard({ look, data: data('circle'), mode: 'screen', foil: false }, PASS, design)),
    ...layoutPieceDocs('details', { look, data: data('circle'), mode: 'print', foil: false }),
    ...layoutPieceDocs('invitation', { look, data: data('circle'), mode: 'print', foil: false }),
  ];
  for (const doc of docs) {
    const { rects, circles, images } = renderedShapes(renderPrintSvg(doc, {}));
    const code = doc.ops.find(isCode)!;
    // The image is drawn at the op's own box (no images handed in → the placeholder still carries the box).
    const q = images.find((im) => Math.abs(im.x - code.x) < 0.02 && Math.abs(im.y - code.y) < 0.02) ?? { x: code.x, y: code.y, w: code.w, h: code.h };
    assert.equal(rectFrame(rects, q), null, `${doc.piece}: rendered rectangles frame the round code`);
    assert.ok(circles.some((c) => holdsDisc(c, q)), `${doc.piece}: no rendered circle holds the round code`);
  }
});

// ── Decoded where it sits ──────────────────────────────────────────────────

const ROUND: QrLook = { shape: 'circle', pattern: 'rounded', dark: QR_INK, light: QR_CREAM, centre: { kind: 'setnayan' } };

test('DECODES: the round code on every Digital ticket design (the saved PNG), on a light and a dark theme', async () => {
  const url = 'https://setnayan.com/cale-ice?invite=tok-abc123';
  // The kit's own override: the code is always black on white on a ticket (lib/pass-card.server.ts).
  const qr = await renderInvitationQrPng({ appUrl: 'https://setnayan.com', slug: 'cale-ice', qrToken: 'tok-abc123', look: { ...ROUND, dark: '#111111', light: '#FFFFFF' }, width: 720, onMonogramError: (e) => assert.fail(String(e)) });
  for (const design of PASS_CARD_DESIGNS) {
    for (const theme of ['house', 'cyber'] as const) {
      const doc = layoutPassCard({ look: printLookFor(theme), data: data('circle'), mode: 'screen', foil: false }, PASS, design);
      const png = await renderPassCardPng(doc, { 'qr-g-1': { bytes: new Uint8Array(qr), mime: 'image/png' } });
      assert.equal(await decodeQrPayloadFromImage(png), url, `${design} · ${theme}: the round code on its round slot scans`);
    }
  }
});

/**
 * 1× — THE TICKET AS A DESKTOP SCREEN SHOWS IT. The guest's Me shows the Digital
 * ticket 300 CSS px wide (`w-[min(300px,100%)]`); on a 1× screen that is 300 real
 * pixels, and the controller measured the Photo-poster round code NOT decoding
 * there (2×, 3× and the saved PNG did). The cause was MODULE SIZE, not the quiet
 * zone: at the square code's box a round code's modules are ~1.4× smaller (its box
 * also holds the filler ring), ~1.9 px each at 300 px. Measured, not guessed: the
 * code's own light ring widened to 3 modules decoded WORSE; a bigger code decoded.
 * So each design gives a round code `ROUND_CODE_ROOM`. Held here: every design ×
 * every pattern × a short and a long invite url, shrunk to 300 px wide.
 */
test('DECODES AT 1×: every Digital ticket design with a round code, shown 300 px wide — every pattern, short and long url', async () => {
  const failed: string[] = [];
  for (const slug of ['ana', 'indalecio-and-claire-2026-wedding']) {
    for (const pattern of ['classic', 'rounded', 'dots'] as const) {
      const qr = await renderInvitationQrPng({ appUrl: 'https://setnayan.com', slug, qrToken: 'guest-pass-of-maria-santos-table-twelve', look: { ...ROUND, pattern, dark: '#111111', light: '#FFFFFF' }, width: 720, onMonogramError: (e) => assert.fail(String(e)) });
      const url = `https://setnayan.com/${slug}?invite=guest-pass-of-maria-santos-table-twelve`;
      for (const design of PASS_CARD_DESIGNS) {
        for (const seat of [null, 'Table 12']) {
          const doc = layoutPassCard({ look: printLookFor('house'), data: data('circle'), mode: 'screen', foil: false }, { ...PASS, seat }, design);
          const png = await renderPassCardPng(doc, { 'qr-g-1': { bytes: new Uint8Array(qr), mime: 'image/png' } });
          const oneX = await sharp(Buffer.from(png)).resize({ width: 300 }).png().toBuffer();
          if ((await decodeQrPayloadFromImage(new Uint8Array(oneX))) !== url) failed.push(`${design} · ${pattern} · ${slug.length > 3 ? 'long' : 'short'} url${seat ? ' · with table' : ''}`);
        }
      }
    }
  }
  assert.deepEqual(failed, [], 'a round code that does not scan off a 1× screen');
});

test('DECODES: the round Event Hub code in its round slot on printed cards — dark paper, at print resolution', async () => {
  const url = 'https://setnayan.com/cale-ice';
  const qr = await renderEventLandingQrPng({ appUrl: 'https://setnayan.com', slug: 'cale-ice', look: ROUND, width: 900, onMonogramError: (e) => assert.fail(String(e)) });
  const images = { eventqr: { bytes: new Uint8Array(qr), mime: 'image/png' as const } };
  for (const theme of ['house', 'cyber'] as const) {
    for (const piece of ['details', 'poster', 'invitation'] as const) {
      const doc = layoutPieceDocs(piece, { look: printLookFor(theme), data: data('circle'), mode: 'print', foil: false })[0]!;
      const code = doc.ops.find(isCode)!;
      // Rasterise the sheet as a 600-dpi print, and cut out the slot with a margin of paper round it.
      // The sheet's own SVG, its viewBox narrowed to the slot and a margin of the card round it,
      // rasterised at 300 dpi — the resolution a print shop prints at.
      const m = code.w * 0.6;
      const [vx, vy, vw] = [code.x - m, code.y - m, code.w + 2 * m];
      const svg = renderPrintSvg(doc, images).replace(
        /viewBox="0 0 [\d.]+ [\d.]+" width="[\d.]+" height="[\d.]+"/,
        `viewBox="${vx} ${vy} ${vw} ${vw}" width="${vw}" height="${vw}"`,
      );
      const png = await sharp(Buffer.from(svg), { density: 300 }).png().toBuffer();
      assert.equal(await decodeQrPayloadFromImage(new Uint8Array(png)), url, `${theme} · ${piece}: the round code in its round slot scans`);
    }
  }
});

// ── On screen: the plate reads the code it holds ───────────────────────────

const WEB = join(__dirname, '..');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsxFiles(p));
    else if (p.endsWith('.tsx') && !p.includes('.test.')) out.push(p);
  }
  return out;
}

/**
 * Codes that are NEVER a guest's styled code — drawn by `renderUrlQrSvg` /
 * `QRCode.toString` (a supplier's link, a crew or camera claim, the free
 * printable event QR, a demo), so they have no shape to follow — and the one
 * styled code that sits on no plate at all.
 */
const NOT_A_STYLED_CODE_ON_A_PLATE: Record<string, string> = {
  'app/dashboard/[eventId]/studio/papic/crew/page.tsx': 'crew seat-claim links — renderUrlQrSvg',
  'app/dashboard/[eventId]/studio/papic/crew/poster/page.tsx': 'crew poster — renderUrlQrSvg',
  'app/dashboard/[eventId]/studio/panood/cameras/page.tsx': 'camera claim links — renderUrlQrSvg',
  'app/dashboard/[eventId]/event-qr/page.tsx': 'the plain printable event QR — QRCode.toString',
  'app/dashboard/[eventId]/_components/supplier-connect-panel.tsx': 'a supplier invite — renderUrlQrSvg (vendors/actions.ts)',
  'app/_components/home/panood-demo-overlay.tsx': 'the marketing demo — not an event’s code',
  'app/_components/home/plan3d-demo-overlay.tsx': 'the marketing demo — not an event’s code',
  'app/vendor-dashboard/on-the-day/_components/guest-review-qr.tsx': 'a supplier’s review link — not a guest code',
  'app/vendor-dashboard/invite/page.tsx': 'a supplier’s invite — renderUrlQrSvg',
  'app/vendor-dashboard/_components/qr-section.tsx': 'a supplier’s shop QR — renderUrlQrSvg',
  'app/(shell)/pa3d/_pa3d-room.tsx': 'the 3D demo room — not an event’s code',
  'app/panood/control/[eventId]/page.tsx': 'camera zone claims — renderUrlQrSvg',
  'app/[slug]/print/print-sheet.tsx': 'styled, but on NO plate (a bare 30 mm box) — nothing square to round',
};

test('ON SCREEN: every plate that is handed a QR string carries `qr-slot` — and the rule rounds it for a round code', () => {
  // 1 · The code says what it is, on its ROOT, as the first thing in the string —
  //     so `:has(> svg[data-qr-shape=…])` on the plate it is injected into matches it.
  const round = styledQrSvg('https://x.test/a?invite=t', { ...ROUND });
  assert.match(round, /^<svg\b[^>]*\bdata-qr-shape="circle"/, 'the round code’s root carries data-qr-shape="circle"');
  assert.match(styledQrSvg('https://x.test/a?invite=t', { ...ROUND, shape: 'square' }), /^<svg\b[^>]*\bdata-qr-shape="square"/);

  // 2 · The rule exists and rounds the plate.
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  const rule = /\.qr-slot:has\(>\s*svg\[data-qr-shape=['"]circle['"]\]\)\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'app/globals.css has the .qr-slot rule for a round code');
  assert.match(rule![1]!, /border-radius:\s*9999px/, 'the rule makes the plate a circle');

  // 3 · Every element a QR string is injected into carries the class (or is a plain code / no plate).
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const file of tsxFiles(join(WEB, 'app'))) {
    const rel = relative(WEB, file);
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]*)\}\}/g)) {
      if (!/qr|pass/i.test(m[1]!)) continue;
      seen.add(rel);
      if (rel in NOT_A_STYLED_CODE_ON_A_PLATE) continue;
      // The opening tag this prop belongs to.
      const before = src.slice(0, m.index);
      const open = Math.max(...[...before.matchAll(/<[a-z][a-z0-9]*\b/g)].map((t) => t.index ?? 0));
      const tag = src.slice(open, m.index);
      if (!/\bqr-slot\b/.test(tag)) missing.push(`${rel}: ${m[0].slice(0, 60)}`);
    }
  }
  assert.deepEqual(missing, [], 'a plate holding a guest QR without qr-slot keeps its square corners round a round code');
  for (const rel of Object.keys(NOT_A_STYLED_CODE_ON_A_PLATE)) assert.ok(seen.has(rel), `${rel} no longer injects a code — drop it from the list`);
  assert.ok(seen.size >= 20, `only ${seen.size} files were swept — the sweep did not run`);
});

test('the Maker’s QR previews (a PNG, not an SVG) sit on a plate that WRAPS the picture and follows the saved shape', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-details.tsx'), 'utf8'));
  const plates = [...src.matchAll(/<span className=\{`[^`]*\$\{qrPlate\}`\} data-qr-plate="">\s*(?:\{[^}]*\}\s*)?<img\b[^>]*\bsrc=\{qrSrc\}[^>]*>/g)];
  assert.equal(plates.length, 2, 'both previews (the address card and Your QR) wrap the code in the shape-following plate');
  for (const p of plates) assert.doesNotMatch(p[0].slice(p[0].indexOf('<img')), /\bbg-white\b|\brounded/, 'the picture itself is never the plate (a round clip would cut a square code’s corners)');
  assert.match(src, /const qrPlate = qr\.style\.shape === 'circle' \? ' rounded-full' : ''/);
});
