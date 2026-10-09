/**
 * 🅻 THE LOGO IS LAYERS — held on the owner's own two files (owner 2026-09-27:
 * *"i want to be able to upload my 2 layer image so each letter gets its own
 * animation. to make our exact logo"*).
 *
 * `scripts/fixtures/logo-layer-1-i.jpg` (the serif I, its stem cut where the C
 * crosses) and `logo-layer-2-c.jpg` (the script C): 2000×2000, black ink on
 * PURE WHITE, no transparency. Uploaded I then C, with zero positioning, they
 * must BE the monogram:
 *
 *   1. each traces to vector (the repo's own tracer) with the white knocked out,
 *      both fill the frame identically, and the C's white never hides the I;
 *   2. the stack is the drawing order — reorder, and the file's order flips;
 *   3. rails: a layer never leaves the frame, and snaps to its centre;
 *   4. the file passes the SVG gate, fits the draft, and reads back exactly;
 *   5. "Draw on" follows the writing path: at 25% the start of the C is drawn
 *      and its end is not, and just before the end nothing is left to pop in —
 *      measured in PIXELS; without a path the outline traces on; each layer
 *      sets its own speed;
 *   6. the page has no header bar, adds Text · Image · Frame, and every guest
 *      surface that plays the mark plays the layers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { stripComments } from './strip-comments';
import { traceRgbaToSvg } from './monogram-studio/trace';
import { sanitizeStudioConfig, sanitizeStudioSvg } from './monogram-studio-shared';
import { HUB_DRAFT_LOGO_MAX_BYTES } from './hub-draft';
import {
  LOGO_FRAME,
  clampToFrame,
  composeLogoSvg,
  defaultMotion,
  effectiveIn,
  frameBody,
  isLayeredLogo,
  layersFromSaved,
  metaOf,
  moveLayer,
  parseLogoSvg,
  retimeLayers,
  sanitizeLogoLayers,
  snapInFrame,
  svgAsLayerBody,
  writeMaskMarkup,
  writeRevealCells,
  writeRevealPlan,
  revealLayersAt,
  writePartPassages,
  reversedWrite,
  logoInSeconds,
  LOGO_WRITE_MAX_PTS,
  type LogoLayer,
} from './logo-layers';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

/* ── the owner's two files, traced exactly as the browser does ─────────────── */

async function traceFixture(name: string): Promise<{ body: string; w: number; h: number }> {
  const { data, info } = await sharp(join(ROOT, 'scripts/fixtures', name))
    .resize(1024, 1024, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const traced = traceRgbaToSvg(new Uint8ClampedArray(data), info.width, info.height);
  assert.ok(traced, `${name} did not trace`);
  const clean = sanitizeStudioSvg(traced.svg);
  assert.ok(clean, `${name}'s trace failed the studio SVG gate`);
  const body = svgAsLayerBody(clean);
  assert.ok(body, `${name}'s trace has no viewBox`);
  return body;
}

function imageLayer(id: string, shape: { body: string; w: number; h: number }, i: number): LogoLayer {
  // Exactly what the editor does for an upload: centred, filling the frame.
  return { id, kind: 'image', name: id, x: LOGO_FRAME / 2, y: LOGO_FRAME / 2, scale: 1, color: null, motion: defaultMotion(i), ...shape };
}

/** Render an SVG and read one pixel's alpha (0–255) at frame coordinates. */
async function alphaAt(svg: string, points: Array<[number, number]>): Promise<number[]> {
  const S = 500;
  const { data, info } = await sharp(Buffer.from(svg)).resize(S, S).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return points.map(([fx, fy]) => {
    const x = Math.round((fx / LOGO_FRAME) * (info.width - 1));
    const y = Math.round((fy / LOGO_FRAME) * (info.height - 1));
    return data[(y * info.width + x) * 4 + 3] as number;
  });
}

/** …and its red channel (0 = black ink, 255 = white). */
async function redAt(svg: string, points: Array<[number, number]>): Promise<number[]> {
  const S = 500;
  const { data, info } = await sharp(Buffer.from(svg)).resize(S, S).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return points.map(([fx, fy]) => {
    const x = Math.round((fx / LOGO_FRAME) * (info.width - 1));
    const y = Math.round((fy / LOGO_FRAME) * (info.height - 1));
    return data[(y * info.width + x) * 4] as number;
  });
}

let I: { body: string; w: number; h: number };
let C: { body: string; w: number; h: number };
test('setup: trace the owner’s two layer files', async () => {
  I = await traceFixture('logo-layer-1-i.jpg');
  C = await traceFixture('logo-layer-2-c.jpg');
  assert.equal(I.w, C.w, 'the two files must trace onto the same canvas');
  assert.equal(I.h, C.h);
});

/* ── 1 · the two uploads ARE the monogram ─────────────────────────────────── */

test('1 · uploaded I then C, with zero positioning, make the monogram — white knocked out', async () => {
  const layers = [imageLayer('ilayer', I, 0), imageLayer('clayer', C, 1)];
  const svg = composeLogoSvg(layers);
  assert.ok(svg);
  // Both fill the frame the same way: one transform for both.
  const transforms = [...svg.matchAll(/data-logo-layer="[a-z]+"[^>]*transform="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(transforms.length, 2);
  assert.equal(transforms[0], transforms[1], 'the two layers are not placed identically');

  // Pixels (frame units): the I's stem low down, where the C's WHITE lies over
  // it in the C file — it must show through; the C's big left bowl; the
  // corner, which is paper in both files and must be empty (no white card).
  const [stem, bowl, corner] = await alphaAt(svg, [
    [500, 640],
    [340, 560],
    [40, 40],
  ]);
  console.log(`[logo] alpha stem=${stem} bowl=${bowl} corner=${corner}`);
  assert.ok((stem ?? 0) > 200, 'the I is hidden — the C layer’s white was not knocked out');
  assert.ok((bowl ?? 0) > 200, 'the C is not drawn');
  assert.equal(corner, 0, 'the white background came back');
  // The I's stem there is black ink, seen THROUGH the C layer…
  const [stemInk] = await redAt(svg, [[500, 640]]);
  assert.ok((stemInk ?? 255) < 60, 'the I’s stem is not the ink showing through');
  // …and "Remove white background" switched OFF puts the C's white card back —
  // which then covers the I exactly as the owner said it would.
  const kept = composeLogoSvg([imageLayer('ilayer', I, 0), { ...imageLayer('clayer', C, 1), keepWhite: true }])!;
  const [under] = await redAt(kept, [[500, 640]]);
  assert.ok((under ?? 0) > 240, 'the kept white card did not cover the layer beneath');
});

/* ── 2 · the stack is the drawing order ───────────────────────────────────── */

test('2 · reorder the layers and the file’s drawing order flips', () => {
  const a = imageLayer('first', I, 0);
  const b = imageLayer('second', C, 1);
  const order = (layers: LogoLayer[]) => [...composeLogoSvg(layers)!.matchAll(/data-logo-layer="([a-z]+)"/g)].map((m) => m[1]);
  const stacked = [a, b];
  assert.deepEqual(order(stacked), ['first', 'second'], 'bottom first — the top of the stack paints last');
  const flipped = moveLayer(stacked, 'first', 'up');
  assert.deepEqual(order(flipped), ['second', 'first'], 'moving a layer up must paint it later');
  assert.deepEqual(moveLayer(flipped, 'first', 'up'), flipped, 'the top layer cannot move further up');
});

/* ── 3 · rails ────────────────────────────────────────────────────────────── */

test('3 · rails: a layer stays inside the frame and snaps to its centre', () => {
  const small = { w: 100, h: 100, scale: 0.2 }; // 200 units across
  assert.deepEqual(clampToFrame(small, -500, 5000), { x: 100, y: 900 }, 'a layer left the frame');
  assert.deepEqual(snapInFrame(small, 510, 489), { x: 500, y: 500 }, 'no snap to the centre');
  assert.deepEqual(snapInFrame(small, 108, 700), { x: 100, y: 700 }, 'no snap to the edge');
  assert.deepEqual(clampToFrame({ w: 100, h: 100, scale: 1.4 }, 100, 900), { x: 500, y: 500 }, 'a layer bigger than the frame must stay centred');
});

/* ── 4 · the file: gate, size, round trip ─────────────────────────────────── */

test('4 · the composed logo passes the SVG gate, fits the draft, and reads back exactly', () => {
  const frame: LogoLayer = { id: 'ring', kind: 'frame', name: 'Ring', x: 500, y: 500, scale: 1, color: '#C5A059', motion: defaultMotion(2), frame: 'ring', ...frameBody('ring') };
  const layers = [imageLayer('ilayer', I, 0), { ...imageLayer('clayer', C, 1), color: '#5C2542' }, frame];
  const svg = composeLogoSvg(layers)!;
  assert.equal(sanitizeStudioSvg(svg), svg, 'the layered logo fails the studio SVG gate');
  assert.ok(svg.length < HUB_DRAFT_LOGO_MAX_BYTES, `the logo is ${svg.length} bytes — over the draft’s limit`);
  assert.ok(isLayeredLogo(svg));
  const back = parseLogoSvg(svg);
  assert.equal(back.get('ilayer')?.body, I.body, 'the I did not read back as it was');
  assert.equal(back.get('clayer')?.body, C.body, 'a recoloured layer did not read back to its own colours');
  // The config keeps the layers through the studio's own sanitizer.
  const cfg = sanitizeStudioConfig({ layers: layers.map(metaOf) });
  assert.equal(cfg?.layers?.length, 3, 'the studio config dropped the layers');
  const reopened = layersFromSaved(cfg!.layers!, svg);
  assert.deepEqual(reopened.map((l) => l.id), ['ilayer', 'clayer', 'ring']);
  assert.equal(composeLogoSvg(reopened), svg, 'reopening and saving again changed the logo');
});

test('4 · the layer config is bounded — malformed layers are dropped, never trusted', () => {
  const out = sanitizeLogoLayers([
    { id: 'ok1', kind: 'text', text: 'I & C<script>', font: 'nope', x: 99999, scale: 99, motion: { in: 'explode', delay: 99 } },
    { id: 'BAD ID', kind: 'image' },
    { id: 'ok1', kind: 'image' },
    { id: 'img', kind: 'image', color: 'red', write: { w: 50, pts: [{ x: 1, y: 2 }] } },
    'junk',
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0]?.text, 'I & Cscript', 'markup survived in a text layer');
  assert.equal(out[0]?.font, 'cardo');
  assert.equal(out[0]?.x, LOGO_FRAME);
  assert.equal(out[0]?.motion.in, 'draw', 'an unknown In must fall back to the default Draw on');
  assert.equal(out[0]?.motion.delay, 4);
  assert.equal(out[1]?.color, null, 'a non-hex colour survived');
  assert.equal(out[1]?.write, undefined, 'a one-point writing path survived');
});

/* ── 5 · Draw on follows the hand that wrote it ───────────────────────────── */

/** How the C is written (owner: "it loops … goes up makes the c and ends with a
 *  curl"), in the traced file's own 1024 box: from the small curl low in the
 *  bowl, up the thick diagonal, round the big arc, to the thin curl at top right. */
const C_WRITTEN = {
  w: 70,
  pts: [
    [480, 648], [430, 660], [380, 640], [360, 580], [380, 510], [430, 460], [490, 420],
    [560, 385], [630, 360], [680, 390], [695, 470], [690, 560], [650, 650], [580, 715],
    [480, 740], [400, 720], [470, 600], [600, 520], [690, 500], [712, 480],
  ].map(([x, y]) => ({ x: x as number, y: y as number })),
};

test('5 · at 25% the C’s start is drawn and its end is not — measured in pixels', async () => {
  const c = { ...imageLayer('clayer', C, 0), write: C_WRITTEN, motion: { in: 'draw' as const, during: 'still' as const, delay: 0 } };
  const at = (p: number) => {
    const svg = composeLogoSvg([c])!;
    // The player's own mask, frozen at progress p, on the layer's body.
    return svg
      .replace('data-logo="layers">', `data-logo="layers"><defs>${writeMaskMarkup('w', c, p)}</defs>`)
      .replace('<g data-logo-body=', '<g mask="url(#w)" data-logo-body=');
  };
  // Frame coordinates of the start curl and the end curl (the 1024 box fills the frame).
  const k = LOGO_FRAME / 1024;
  const START: [number, number] = [480 * k, 648 * k];
  const END: [number, number] = [712 * k, 480 * k];
  const [full0, full1] = await alphaAt(composeLogoSvg([c])!, [START, END]);
  assert.ok((full0 ?? 0) > 200 && (full1 ?? 0) > 200, 'anti-vacuity: both probe points must be ink in the finished letter');
  const [q0, q1] = await alphaAt(at(0.25), [START, END]);
  console.log(`[logo] draw-on at 25%: start=${q0} end=${q1}`);
  assert.ok((q0 ?? 0) > 200, 'at 25% the start of the C is not drawn');
  assert.equal(q1, 0, 'at 25% the end of the C is already drawn — the reveal is not following the writing');
  const [d0, d1] = await alphaAt(at(1), [START, END]);
  assert.ok((d0 ?? 0) > 200 && (d1 ?? 0) > 200, 'at 100% the whole letter must be drawn');

  // 🔑 NOTHING IS SAVED FOR THE END (owner 2026-09-28: "the trace does not
  // follow properly"). The first build's brush left 29% of this C hidden until
  // the mask came off, then popped it in. Just before the pen finishes, the
  // mask must already show all but a sliver of the ink.
  const inkPx = async (svg: string) => {
    const { data } = await sharp(Buffer.from(svg)).resize(400, 400).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if ((data[i] as number) > 128) n++;
    return n;
  };
  const full = await inkPx(composeLogoSvg([c])!);
  const nearEnd = await inkPx(at(0.97));
  console.log(`[logo] ink shown at 97% of the pen: ${((100 * nearEnd) / full).toFixed(1)}%`);
  assert.ok(nearEnd / full > 0.95, 'ink is still hidden near the end — it will pop in when the mask comes off');
});

test('5 · each part follows only the pen that is on it — never early because the pen passed close by', () => {
  // Two parts with a small gap: A = x 100…480, B = x 500…900 (both y 400…600).
  // The pen runs along A, then crosses the gap onto B.
  const inA = (x: number, y: number) => x >= 100 && x <= 480 && y >= 400 && y <= 600;
  const inB = (x: number, y: number) => x >= 500 && x <= 900 && y >= 400 && y <= 600;
  const write = { w: 60, pts: [{ x: 100, y: 500 }, { x: 900, y: 500 }] };
  const plan = writeRevealPlan(write, 1000, 1000, 2, (k, x, y) => (k === 0 ? inA(x, y) : inB(x, y)));
  const tEnterB = (500 - 100) / 800;
  const tLeaveA = (480 - 100) / 800;
  const firstB = Math.min(...(plan[1] ?? []).map((c) => c.t));
  const lastA = Math.max(...(plan[0] ?? []).map((c) => c.t));
  assert.ok(firstB >= tEnterB - 0.01, `part B starts at ${firstB.toFixed(3)} — before the pen reached it (${tEnterB})`);
  assert.ok(lastA <= tLeaveA + 0.01, `part A is still revealing at ${lastA.toFixed(3)} — after the pen left it`);
  // Without the parts (one cell set for the whole box), B's near edge would
  // show as the pen reached the gap — the leak the parts exist to stop.
  const whole = writeRevealCells(write, 1000, 1000);
  assert.ok(whole.some((c) => c.t > tLeaveA && c.t < tEnterB), 'anti-vacuity: the gap has pen positions of its own');
  // A part the pen never touches still appears — where the pen passes nearest.
  const [untouched] = writeRevealPlan(write, 1000, 1000, 1, () => false);
  assert.equal(untouched?.length, whole.length);
});

test('5 · one path per band — no cell seams, and the soft tip leads the pen', () => {
  const write = { w: 60, pts: [{ x: 100, y: 500 }, { x: 900, y: 500 }] };
  const mask = writeMaskMarkup('m', { w: 1000, h: 1000, write }, 0.5);
  assert.equal((mask.match(/<path /g) ?? []).length, 3, 'the reveal must be at most three paths (solid + a two-band tip), not a path per cell');
  const cells = writeRevealCells(write, 1000, 1000);
  const r = revealLayersAt(cells, 0.5);
  assert.ok(r.solid && r.near && r.far, 'the tip is missing');
  assert.equal(revealLayersAt(cells, 0).solid, '', 'something shows before the pen starts');
  assert.equal(revealLayersAt(cells, 1).near, '', 'the tip outlives the pen');
});

test('5 · the pen CROSSING a part does not draw it — the pass along it does', () => {
  // A thin line (y 490…510, x 100…900, with a gap at x 440…560) and a big
  // stroke across it (x 450…550, every y). The pen runs along the thin line —
  // crossing the big stroke — then turns and runs down the big stroke.
  const thinL = (x: number, y: number) => y >= 490 && y <= 510 && x >= 100 && x <= 440;
  const thinR = (x: number, y: number) => y >= 490 && y <= 510 && x >= 560 && x <= 900;
  const big = (x: number, y: number) => x >= 450 && x <= 550 && y >= 0 && y <= 1000;
  const covers = (k: number, x: number, y: number) => [thinL, thinR, big][k]!(x, y);
  const write = { w: 60, pts: [{ x: 100, y: 500 }, { x: 900, y: 500 }, { x: 900, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 950 }] };
  const plan = writeRevealPlan(write, 1000, 1000, 3, covers);
  const firstBig = Math.min(...(plan[2] ?? []).map((c) => c.t));
  const lastThinR = Math.max(...(plan[1] ?? []).map((c) => c.t));
  assert.ok(firstBig > lastThinR, `the big stroke starts at ${firstBig.toFixed(3)}, before the thin line has finished (${lastThinR.toFixed(3)}) — the crossing drew it`);
  const [, , pBig] = writePartPassages(write, 3, covers);
  assert.ok((pBig?.start.y ?? 0) < 200, 'the big stroke is numbered at the crossing, not where its own pass begins');
});

test('5 · the editor numbers each part where the pen first reaches it — and can flip a backwards trace', () => {
  // Parts A (x 100…480) and B (x 500…900); a third part C the pen never touches.
  const inA = (x: number, y: number) => x >= 100 && x <= 480 && y >= 400 && y <= 600;
  const inB = (x: number, y: number) => x >= 500 && x <= 900 && y >= 400 && y <= 600;
  const covers = (k: number, x: number, y: number) => (k === 0 ? inA(x, y) : k === 1 ? inB(x, y) : false);
  const forward = { w: 60, pts: [{ x: 100, y: 500 }, { x: 900, y: 500 }] };
  const [a, b, c] = writePartPassages(forward, 3, covers);
  assert.equal(a?.order, 1);
  assert.equal(b?.order, 2);
  assert.equal(c, null, 'a part the pen never touches must stay unnumbered');
  assert.ok(Math.abs((a?.start.x ?? 0) - 100) < 5 && Math.abs((b?.start.x ?? 0) - 500) < 5, 'the number must sit where the pen enters the part');
  // Traced from the wrong end: Reverse flips the order without tracing again.
  const back = reversedWrite(forward);
  assert.deepEqual(back.pts[0], { x: 900, y: 500 });
  const [a2, b2] = writePartPassages(back, 3, covers);
  assert.equal(b2?.order, 1);
  assert.equal(a2?.order, 2);
});

test('5 · the editor and the player find the parts the same way', () => {
  const editor = code('app/dashboard/[eventId]/launch/_components/maker-logo.tsx');
  const player = code('app/_components/layered-logo-player.tsx');
  for (const [name, src] of [['editor', editor], ['player', player]] as const) {
    assert.match(src, /logoParts\(/, `the ${name} finds parts its own way`);
    assert.match(src, /partCovers\(/, `the ${name} tests the pen against parts its own way`);
  }
  assert.match(editor, /data-logo-write-ends/, 'the trace no longer shows its Start and End');
  assert.match(editor, /reversedWrite\(layer\.write/, 'a backwards trace can no longer be flipped');
  // owner 2026-09-28 "we should be able to rename these layers"
  assert.match(editor, /data-logo-layer-name/, 'a layer can no longer be renamed');
  assert.match(editor, /onChange\(\{ name: /);
});

test('5 · a long, slow trace keeps its END — thinned evenly, never cut', () => {
  const pts = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i % 7 }));
  const kept = sanitizeLogoLayers([{ id: 'c1', kind: 'image', write: { w: 60, pts } }])[0]?.write?.pts ?? [];
  assert.equal(kept.length, LOGO_WRITE_MAX_PTS);
  assert.deepEqual(kept[kept.length - 1], { x: 999, y: 999 % 7 }, 'the closing curl was cut off the trace');
  assert.deepEqual(kept[0], { x: 0, y: 0 });
});

test('5 · Draw on without a writing path traces the outline — and it is the default', () => {
  const noPath: LogoLayer = { ...imageLayer('clayer', C, 0), motion: { in: 'draw', during: 'still', delay: 0 } };
  assert.equal(effectiveIn(noPath), 'draw');
  assert.match(composeLogoSvg([noPath])!, /data-in="draw"/);
  assert.doesNotMatch(composeLogoSvg([noPath])!, /data-write=/);
  // owner 2026-09-28 "logo animation lost its trace effect": an upload traces on.
  assert.equal(defaultMotion(0).in, 'draw');
  const withPath = { ...noPath, write: C_WRITTEN };
  assert.match(composeLogoSvg([withPath])!, /data-in="draw" data-during="still" data-delay="0" data-write="M480 648L/);
  // A new upload arrives after the layer below it finishes.
  assert.ok(defaultMotion(1).delay > defaultMotion(0).delay, 'letter 2 does not follow letter 1');
});

test('5 · default delays follow the stack — remove the layer under the I and the I comes in first', () => {
  const auto = (l: LogoLayer): LogoLayer => ({ ...l, autoDelay: true });
  const placeholder = auto(imageLayer('old', I, 0));
  const i = auto(imageLayer('ilayer', I, 1));
  const c = auto(imageLayer('clayer', C, 2));
  const after = retimeLayers([i, c]); // the placeholder removed
  assert.equal(after[0]?.motion.delay, 0, 'the I (now bottom) does not come in first');
  assert.equal(after[1]?.motion.delay, defaultMotion(1).delay, 'the C does not follow the I');
  assert.ok(placeholder.motion.delay === 0);
  // A delay the couple chose is theirs — never re-timed.
  const chosen = { ...c, autoDelay: false, motion: { ...c.motion, delay: 3.3 } };
  assert.equal(retimeLayers([i, chosen])[1]?.motion.delay, 3.3);
  // …and the editor-only flag is never saved.
  assert.ok(!('autoDelay' in metaOf(after[0]!)));
});

test('5 · the player follows the pen with a path, and traces the outline without one', () => {
  const src = code('app/_components/layered-logo-player.tsx');
  assert.match(src, /getAttribute\('data-write'\)/);
  assert.match(src, /createElementNS\(NS, 'mask'\)/);
  assert.match(src, /writeRevealPlan\(write, w, h, parts\.length, covers\)/, 'the reveal must be the pen’s cells per part, not a brush');
  assert.match(src, /part\.setAttribute\('mask'/, 'each part must carry its own reveal');
  // 🧈 owner 2026-09-28 "i see unsmooth effects": one growing shape per part,
  // redrawn once a frame — never an animation per cell (that stuttered and striped).
  assert.match(src, /revealLayersAt\(b\.cells, p\)/, 'the reveal is not one growing shape per part');
  assert.match(src, /requestAnimationFrame\(paint\)/);
  assert.doesNotMatch(src, /piece\.animate\(/, 'an animation per cell is back — it stutters on a phone');
  assert.match(src, /strokeDashoffset: len \+ 1 \}, \{ strokeDashoffset: 0 \}/, 'without a path the outline must trace on');
  // owner 2026-09-28 "the start started with 2 points. i should have started on
  // one": each outline waits for the one before it — one pen, one start.
  assert.match(src, /delay: delayMs \+ \(done \/ all\) \* strokeMs/, 'the outlines start together — the draw begins in several places');
  assert.match(src, /logoInSeconds\(motion\)/, 'the player ignores the layer’s speed');
  assert.doesNotMatch(src, /clipPath/, 'the left-to-right wipe is back');
});

test('5 · each layer sets its own speed — and a logo saved before keeps its timing', () => {
  const [a, b, bad] = sanitizeLogoLayers([
    { id: 'aa', kind: 'image', motion: { in: 'draw', dur: 5.04 } },
    { id: 'bb', kind: 'image', motion: { in: 'draw' } },
    { id: 'cc', kind: 'image', motion: { in: 'rise', dur: 999 } },
  ]);
  assert.equal(a?.motion.dur, 5);
  assert.equal(logoInSeconds(a!.motion), 5);
  assert.equal(b?.motion.dur, undefined, 'a speed appeared that nobody set');
  assert.equal(logoInSeconds(b!.motion), 2);
  assert.equal(bad?.motion.dur, 8, 'the speed is not bounded');
  const svg = composeLogoSvg([{ ...imageLayer('clayer', C, 0), motion: { in: 'draw', during: 'still', delay: 0, dur: 4.5 } }])!;
  assert.match(svg, /data-dur="4.5"/);
  assert.doesNotMatch(composeLogoSvg([imageLayer('clayer', C, 0)])!, /data-dur=/);
});

/* ── 6 · the page, and what guests see ────────────────────────────────────── */

test('6 · the Logo page has no header bar, and adds Text · Image · Frame', () => {
  const page = code('app/dashboard/[eventId]/launch/_components/maker-logo.tsx');
  for (const gone of ['Back to', 'Have a logo already', 'Every change saves', 'Upload it instead', 'SETNAYAN', 'VectorStudio', '<header']) {
    assert.ok(!page.includes(gone), `the Logo page still has "${gone}"`);
  }
  assert.match(page, /aria-label="Logo layers"/);
  assert.match(page, /aria-label="Layer tools"/);
  /* RE-AIMED 2026-10-09 (Studio › Logo's chrome moved onto the templates — `studio-logo-are-the-templates.test.ts` holds the new shape): the adds are the ActionButton, each marked by its kind. */
  for (const kind of ['Text', 'Image', 'Frame']) assert.match(page, new RegExp(`data-logo-add-kind="${kind.toLowerCase()}">\\s*<ActionButton[^>]*label="${kind}"`), `no "+ ${kind}"`);
  // Phone: both panels sit UNDER the logo, never a lower-third tool (L1 2026-10-08, the one-layer trap) —
  // the full contract is `the-logo-maker-opens-ready-to-edit.test.ts`.
  assert.equal((page.match(/sn-glass-bare flex-col \$\{LOGO_PANEL_PHONE\}/g) ?? []).length, 2, 'a logo panel is not under the logo');
  // The status is the toolbar's, not a bar of the page's own.
  assert.match(page, /announceMakerSave\(\{ state: 'saving' \}\)/);
  const bar = code('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /useEffect\(\(\) => onMakerSave\(setSaveStatus\), \[\]\)/);
  assert.match(bar, /data-maker-save-status=/);
  // Uploads use the repo's own tracer — no new tracing library.
  assert.match(page, /await fileToMarkSvg\(file\)/);
});

test('6 · every surface that plays the mark plays the layers', () => {
  const hero = code('app/_components/hero-monogram.tsx');
  assert.match(hero, /if \(animatedMonogram && isLayeredLogo\(bespokeSvg\)\)/, 'the hero does not play the layers');
  // Through CoupleLogo (owner 2026-09-29, "all logos should animate if
  // animation is active") — which plays THE one player.
  // `plays` is the one rule, asked by the hero over the same svg (2026-10-04:
  // CoupleLogo no longer imports logo-layers to ask it).
  assert.match(hero, /<CoupleLogo\s+svg=\{bespokeSvg\}\s+plays=\{coupleLogoPlays\(bespokeSvg, Boolean\(animatedMonogram\)\)\}/);
  assert.match(code('app/_components/couple-logo.tsx'), /<LayeredLogoPlayer svg=\{svg\}/, 'CoupleLogo plays something other than the one player');
  const player = code('app/_components/studio-reveal-player.tsx');
  assert.match(player, /if \(svg && isLayeredLogo\(svg\)\) return <LayeredLogoPlayer/, 'the reveal player does not play the layers');
  // The editor's Play is the same player.
  assert.match(code('app/dashboard/[eventId]/launch/_components/maker-logo.tsx'), /<LayeredLogoPlayer key=\{playKey\} svg=\{composed\} \/>/);
});
