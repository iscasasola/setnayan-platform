/**
 * lib/every-qr-look-decodes.test.ts — A STYLE THAT DOES NOT SCAN DOES NOT SHIP.
 *
 * The Pro QR build (owner 2026-09-27: Setnayan logo on every free code; the
 * couple's logo + Square/Circle + pattern styles on Event Hub Pro) gives a QR
 * eighteen looks: 2 shapes × 3 patterns × 3 centres. Every one of them is
 * RENDERED here — as the SVG a page shows and as the PNG a guest saves — and
 * the PNG is DECODED with the repo's own detector (jsQR behind
 * lib/qr-decode.ts) back to the exact url it encodes. Twice: at full size, and
 * after the downscale-and-recompress a messaging app inflicts on a forwarded
 * picture, because that is the copy that reaches the 75 of 77 guests with no
 * email address.
 *
 * ── WHAT THESE ASSERTIONS REFUSE TO BE ────────────────────────────────────
 * Not "errorCorrectionLevel: 'H' was passed". Not "the look object has
 * centre.kind === 'setnayan'". A flag in an object is not ink in the pixels
 * (this repo has shipped that mistake). So the free look's mark is COUNTED in
 * the centre pixels of a real raster, the finders are checked in the emitted
 * geometry, the circle's radius is checked against the code's own module
 * count, and the payload is read back by a detector that never saw the input.
 *
 * ── THE RULES IT HOLDS, EACH ONE A SENTENCE IN lib/qr-look.ts ─────────────
 *   · every look decodes (shape × pattern × centre, full and recompressed);
 *   · the FREE look carries the Setnayan mark in the pixels, and a Pro couple
 *     whose Pro lapsed gets the free look regardless of what they saved;
 *   · the three finder patterns are solid squares whatever the pattern, and no
 *     styled module is ever drawn inside a finder;
 *   · a circle ground contains the whole code AND its quiet zone;
 *   · the centre badge never exceeds its cap;
 *   · an ink below the contrast floor is refused everywhere it could enter;
 *   · every guest-facing renderer call in the app passes the event's look.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { QUIET, logoCentreSvg, styledQrSvg } from '@/lib/qr-style-svg';
import { styledQrPng } from '@/lib/qr-style-raster';
import { decodeQrPayloadFromImage } from '@/lib/qr-decode';
import {
  BADGE_RADIUS_FRACTION,
  FREE_QR_LOOK,
  MIN_INK_CONTRAST,
  QR_CREAM,
  QR_INK,
  QR_PATTERNS,
  QR_SHAPES,
  SETNAYAN_GOLD,
  contrastRatio,
  qrInkChoices,
  qrInkPasses,
  qrLookFor,
  sanitizeQrStyle,
  type QrLook,
} from '@/lib/qr-look';
import { QR_LOOK_COLUMNS, QR_LOOK_COLUMNS_AFTER_INVITE_MARK, QR_LOOK_EXTRA_COLUMNS, qrLookFromRow } from '@/lib/qr-look.server';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-data';
import { buildEventLandingUrl, buildInvitationUrl, renderEventLandingQrPng, renderInvitationQrPng, renderInvitationQrSvg } from '@/lib/qr';
import { resolveMonogram, type MonogramConfig } from '@/lib/monogram';
import { stripComments } from '@/lib/strip-comments';

const WEB = path.join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(path.join(WEB, rel), 'utf8'));

const URL_ = 'https://setnayan.com/ana-at-marco?invite=3de2e5e15d0e19ba5f8161085ff37e88';
const MONO: MonogramConfig = resolveMonogram({
  display_name: 'Maria & Juan',
  monogram_text: null,
  monogram_color: '#C97B4B',
  monogram_font_key: 'script',
  monogram_style: 'script',
  monogram_frame_key: null,
});
/** A real SVG document with <defs>, a clipPath and a transform — the shape a drawn
 *  logo takes. The file's `<?xml …?>` prolog and comment are cut because the
 *  read-time sanitizer (lib/monogram-svg-safe.ts) admits only a document that
 *  STARTS with `<svg` — which is what every studio-written logo does. */
const LOGO_FILE = readFileSync(path.join(WEB, 'public', 'brand', 'setnayan-mark.svg'), 'utf8');
const LOGO = LOGO_FILE.slice(LOGO_FILE.indexOf('<svg'));
const CENTRES: QrLook['centre'][] = [{ kind: 'setnayan' }, { kind: 'monogram', monogram: MONO }, { kind: 'logo', svg: LOGO }];
const MULBERRY = '#5C2542';

function everyLook(): Array<{ name: string; look: QrLook }> {
  const out: Array<{ name: string; look: QrLook }> = [];
  for (const s of QR_SHAPES) {
    for (const p of QR_PATTERNS) {
      for (const c of CENTRES) {
        out.push({
          name: `${s.key} · ${p.key} · ${c.kind}`,
          look: { shape: s.key, pattern: p.key, dark: MULBERRY, light: QR_CREAM, centre: c },
        });
      }
    }
  }
  return out;
}

/** What a messaging app does to a forwarded picture: shrink it and JPEG it. */
async function forwarded(png: Buffer): Promise<Uint8Array> {
  return new Uint8Array(await sharp(png).resize(320, 320).flatten({ background: '#fff' }).jpeg({ quality: 60 }).toBuffer());
}

// ── 1 · EVERY LOOK DECODES ─────────────────────────────────────────────────

/** A short payload makes a SMALLER code with BIGGER cells — the case that
 *  caught the first dotted pattern (r = .44 failed at every size on this one
 *  while passing on the long url). Both are checked, always. */
const SHORT_URL = 'https://x.test/ana-at-marco?invite=tok-abc';

test('every shape × pattern × centre renders and decodes to the exact url — long and short payloads, full size and forwarded', async () => {
  const looks = everyLook();
  assert.equal(looks.length, 18, 'the matrix is 2 × 3 × 3 — a shape or pattern was added without joining this suite');
  for (const { name, look } of looks) {
    for (const url of [URL_, SHORT_URL]) {
      const svg = styledQrSvg(url, look, { width: 512 });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), `${name}: not an SVG document`);
      assert.ok(svg.includes(`data-qr-shape="${look.shape}"`) && svg.includes(`data-qr-pattern="${look.pattern}"`), `${name}: the SVG does not say what it is`);
      const png = await styledQrPng(url, look, 512);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${name}: not a PNG`);
      assert.equal(await decodeQrPayloadFromImage(new Uint8Array(png)), url, `${name} (${url.length} chars): the saved picture does not decode to its url`);
      assert.equal(await decodeQrPayloadFromImage(await forwarded(png)), url, `${name} (${url.length} chars): the forwarded (320px JPEG) copy does not decode`);
    }
  }
});

test('the two shipped renderers encode the same url the plain code does, in every look', async () => {
  const P = { appUrl: 'https://x.test', slug: 'ana-at-marco', qrToken: 'tok-abc' };
  for (const { name, look } of everyLook()) {
    const png = await renderInvitationQrPng({ ...P, look, width: 480, onMonogramError: (e) => assert.fail(`${name}: styled render fell back: ${String(e)}`) });
    assert.equal(await decodeQrPayloadFromImage(new Uint8Array(png)), buildInvitationUrl(P), `${name}: invitation PNG`);
  }
  const landing = await renderEventLandingQrPng({ appUrl: 'https://x.test', slug: 'ana-at-marco', look: everyLook()[17]!.look, width: 480 });
  assert.equal(await decodeQrPayloadFromImage(new Uint8Array(landing)), buildEventLandingUrl({ appUrl: 'https://x.test', slug: 'ana-at-marco' }));
});

// ── 2 · THE FREE LOOK'S MARK IS IN THE PIXELS ─────────────────────────────

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function countNearInCentre(png: Buffer, hex: string, tol = 28): Promise<number> {
  const { data, info } = await sharp(png).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = hexRgb(hex);
  const w = info.width;
  let n = 0;
  for (let y = Math.round(w * 0.42); y < Math.round(w * 0.58); y += 1) {
    for (let x = Math.round(w * 0.42); x < Math.round(w * 0.58); x += 1) {
      const i = (y * w + x) * info.channels;
      if (Math.abs(data[i]! - r) <= tol && Math.abs(data[i + 1]! - g) <= tol && Math.abs(data[i + 2]! - b) <= tol) n += 1;
    }
  }
  return n;
}

test('the FREE look draws the Setnayan mark, in gold, in the centre pixels of the saved code', async () => {
  const free = await styledQrPng(URL_, FREE_QR_LOOK, 512);
  const gold = await countNearInCentre(free, SETNAYAN_GOLD);
  assert.ok(gold > 400, `only ${gold} gold pixels in the centre — the mark did not draw`);
  // A code with the couple's lockup instead carries none of the brand gold.
  const pro = await styledQrPng(URL_, { ...FREE_QR_LOOK, centre: { kind: 'monogram', monogram: MONO } }, 512);
  assert.equal(await countNearInCentre(pro, SETNAYAN_GOLD), 0, 'a Pro code must not carry the Setnayan mark');
  // And the plain default the renderer falls to when no look is given IS the free look.
  const svg = await renderInvitationQrSvg({ appUrl: 'https://x.test', slug: 's', qrToken: 't' });
  assert.ok(svg.includes('data-qr-centre="setnayan"'), 'a renderer given no look must render the free look, never a bare code');
});

// ── 3 · FINDERS STAY SQUARE; NO MODULE INSIDE THEM ────────────────────────

test('the three finder patterns are solid squares in every pattern, and no styled module lands inside one', () => {
  const n = QRCode.create(URL_, { errorCorrectionLevel: 'H' }).modules.size;
  for (const p of QR_PATTERNS) {
    const svg = styledQrSvg(URL_, { ...FREE_QR_LOOK, pattern: p.key });
    // One evenodd path holding exactly three 7×7 rings + hearts, in the ink.
    const finders = (svg.match(/h7v7h-7z/g) ?? []).length;
    assert.equal(finders, 3, `${p.key}: expected 3 square finders, found ${finders}`);
    if (p.key === 'classic') continue;
    const uses = [...svg.matchAll(/<use href="#qm-\w+" x="([\d.]+)" y="([\d.]+)"\/>/g)].map((m) => [parseFloat(m[1]!) - QUIET, parseFloat(m[2]!) - QUIET] as const);
    assert.ok(uses.length > 200, `${p.key}: only ${uses.length} modules drawn — the matrix walk is broken`);
    const inFinder = uses.filter(([c, r]) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7));
    assert.deepEqual(inFinder, [], `${p.key}: ${inFinder.length} styled module(s) drawn inside a finder pattern`);
  }
});

// ── 4 · THE CIRCLE HOLDS THE WHOLE CODE AND ITS QUIET ZONE ────────────────

test('a circle ground is large enough for the code plus the quiet zone, and the finders keep their quiet zone', () => {
  const n = QRCode.create(URL_, { errorCorrectionLevel: 'H' }).modules.size;
  const svg = styledQrSvg(URL_, { ...FREE_QR_LOOK, shape: 'circle' });
  const vb = /viewBox="0 0 ([\d.]+) [\d.]+"/.exec(svg);
  const disc = /<circle cx="([\d.]+)" cy="[\d.]+" r="([\d.]+)" fill="#FAF7F2"\/>/.exec(svg);
  assert.ok(vb && disc, 'circle shape did not emit a canvas and a disc');
  const r = parseFloat(disc![2]!);
  const need = (n / 2 + QUIET) * Math.SQRT2;
  assert.ok(r >= need - 0.01, `disc radius ${r} < ${need.toFixed(2)} needed to hold the code and its ${QUIET}-module quiet zone`);
  assert.ok(parseFloat(vb![1]!) >= 2 * r, 'the canvas is smaller than the disc');
});

// ── 5 · THE BADGE IS CAPPED ───────────────────────────────────────────────

test('the centre badge never exceeds its cap, and a drawn logo fits inside it', () => {
  const n = QRCode.create(URL_, { errorCorrectionLevel: 'H' }).modules.size;
  const side = n + 2 * QUIET;
  for (const c of CENTRES) {
    const svg = styledQrSvg(URL_, { ...FREE_QR_LOOK, centre: c });
    const badge = [...svg.matchAll(/<circle cx="[\d.]+" cy="[\d.]+" r="([\d.]+)" fill="[^"]+" stroke=/g)].map((m) => parseFloat(m[1]!));
    assert.equal(badge.length, 1, `${c.kind}: expected one badge ring`);
    assert.ok(badge[0]! <= side * BADGE_RADIUS_FRACTION + 0.01, `${c.kind}: badge radius ${badge[0]} over the cap ${side * BADGE_RADIUS_FRACTION}`);
    if (c.kind !== 'monogram') {
      const art = /<svg x="[\d.]+" y="[\d.]+" width="([\d.]+)"/.exec(svg.slice(svg.indexOf('stroke=')));
      assert.ok(art, `${c.kind}: the centre art is missing`);
      assert.ok(parseFloat(art![1]!) <= badge[0]! * 1.5 + 0.01, `${c.kind}: art box wider than the badge allows`);
    }
  }
  // A logo document with no viewBox and no size still embeds (a default box), and junk is refused.
  assert.ok(logoCentreSvg('<svg><path d="M0 0h1v1z"/></svg>', 10, 10, 4, QR_INK)?.includes('viewBox="0 0 100 100"'));
  assert.equal(logoCentreSvg('not an svg', 10, 10, 4, QR_INK), null);
});

// ── 6 · THE CONTRAST FLOOR, EVERYWHERE AN INK CAN ENTER ───────────────────

test('an ink below the contrast floor is refused by the choices, by the sanitizer and by the composer', () => {
  const pale = '#F3E6D8';
  const blush = '#E8B4B8';
  assert.ok(contrastRatio(pale, QR_CREAM) < MIN_INK_CONTRAST, 'the fixture must actually be too pale');
  assert.equal(qrInkPasses(pale), false);
  assert.equal(qrInkPasses(blush), false);
  assert.equal(qrInkPasses(MULBERRY), true);
  assert.equal(qrInkPasses('#FFFFFF'), false, 'white on cream would invert the code');
  assert.equal(qrInkPasses('not a colour'), false);
  // Palette → choices: order kept, duplicates dropped, pale dropped, custom roles included.
  const palette = { ceremony: [pale, MULBERRY], reception: ['#1E2229', MULBERRY], custom_roles: [{ key: 'ushers', label: 'Ushers', colors: ['#824A2A', blush] }] };
  assert.deepEqual(qrInkChoices(palette, ['ceremony', 'reception']), [MULBERRY, '#1E2229', '#824A2A']);
  // Saved config is data a human saved: every field re-checked.
  assert.deepEqual(sanitizeQrStyle({ shape: 'triangle', pattern: 'dots', ink: pale }), { pattern: 'dots' });
  assert.deepEqual(sanitizeQrStyle({ shape: 'circle', pattern: 'rounded', ink: MULBERRY.toLowerCase() }), { shape: 'circle', pattern: 'rounded', ink: MULBERRY });
  assert.deepEqual(sanitizeQrStyle('junk'), {});
  // The composer: a stored pale ink (bypassing the sanitizer) still renders in ink.
  const look = qrLookFor({ ownsPro: true, style: { ink: pale, shape: 'circle' }, monogram: MONO, logoSvg: null });
  assert.equal(look.dark, QR_INK);
  assert.equal(look.shape, 'circle');
});

// ── 7 · THE PRO RULE ─────────────────────────────────────────────────────

test('Pro decides the look: free ignores every saved choice; Pro gets the logo, or the lockup when there is none', () => {
  const row = {
    display_name: 'Maria & Juan',
    monogram_text: null,
    monogram_color: '#C97B4B',
    monogram_font_key: 'script',
    monogram_style: 'script',
    monogram_frame_key: null,
    monogram_custom_svg: LOGO,
    monogram_uploaded_svg: null,
    role_palette: { reception: [MULBERRY] },
    style_preferences: { qr: { shape: 'circle', pattern: 'dots', ink: MULBERRY }, interested_categories: ['x'] },
  };
  const free = qrLookFromRow(row, false);
  assert.deepEqual(free, FREE_QR_LOOK, 'a free event must get the free look whatever it saved');
  const pro = qrLookFromRow(row, true);
  assert.equal(pro.centre.kind, 'logo', 'a Pro event with a drawn logo wears it');
  assert.equal(pro.shape, 'circle');
  assert.equal(pro.pattern, 'dots');
  assert.equal(pro.dark, MULBERRY);
  const lettered = qrLookFromRow({ ...row, monogram_custom_svg: null }, true);
  assert.equal(lettered.centre.kind, 'monogram', 'a Pro event with no drawn logo wears its lockup');
  // A logo that asks for a font is refused for BOTH surfaces — screen and file
  // must agree, and the file cannot draw a font request on a lambda.
  const texty = qrLookFromRow({ ...row, monogram_custom_svg: '<svg viewBox="0 0 10 10"><text x="1" y="8">MJ</text></svg>' }, true);
  assert.equal(texty.centre.kind, 'monogram');
  assert.equal(qrLookFromRow(null, true).centre.kind, 'setnayan', 'no row → the free look');
});

// ── 7b · THE SELECT FRAGMENTS ARE THE CANONICAL LIST, SPELLED FOR THE SCANNER ─

test('QR_LOOK_COLUMNS is HERO_MONOGRAM_COLUMNS plus the look\'s two, byte for byte', () => {
  // A literal (the select scanner cannot resolve a template) that must never
  // drift from the canonical list it copies.
  assert.equal(QR_LOOK_COLUMNS, `${HERO_MONOGRAM_COLUMNS}, ${QR_LOOK_EXTRA_COLUMNS}`);
  const split = (s: string) => s.split(',').map((c) => c.trim());
  // The invite door's select = INVITE_LOOK_COLUMNS (= HUB_LOOK_COLUMNS) +
  // INVITE_MARK_COLUMNS + this fragment. Together they must cover every column
  // QR_LOOK_COLUMNS names, and name none of them twice. The two door lists live
  // in `server-only` modules, so they are read from SOURCE here (the same way
  // the-door-wears-the-hub.test.ts pins INVITE_MARK_COLUMNS).
  const literal = (rel: string, name: string) => {
    const m = new RegExp(`export const ${name} =\\s*'([^']*)'`).exec(read(rel));
    assert.ok(m, `${name} not found in ${rel} — the door's select moved`);
    return m![1]!;
  };
  const door = [
    // The door's own literal prefix names display_name before the three lists.
    'display_name',
    ...split(literal('app/[slug]/_lib/hub-look.ts', 'HUB_LOOK_COLUMNS')),
    ...split(literal('app/[slug]/invite/_lib/load-invite-look.ts', 'INVITE_MARK_COLUMNS')),
    ...split(QR_LOOK_COLUMNS_AFTER_INVITE_MARK),
  ];
  assert.equal(new Set(door).size, door.length, 'the invite door names a column twice');
  for (const c of split(QR_LOOK_COLUMNS)) assert.ok(door.includes(c), `the invite door's select lacks ${c} — its pass would lose part of the look`);
});

// ── 8 · EVERY GUEST-FACING CALL PASSES THE LOOK ───────────────────────────

/**
 * The surfaces that draw a code a GUEST scans. Each must hand the renderer the
 * event's look — an argument literally named `look` — so a code can never be
 * drawn from a stale `monogram` or with no centre at all. The list is
 * exhaustive on purpose: a new guest QR surface joins it or this goes red.
 */
const GUEST_QR_SURFACES: Array<[file: string, call: RegExp]> = [
  ['app/api/website/qr/[slug]/route.ts', /renderEventLandingQrPng\(\{[^}]*\blook\b/s],
  ['app/api/website/qr/guest/[guestId]/route.ts', /renderInvitationQrPng\(\{[^}]*\blook\b/s],
  ['app/api/guest/qr/route.ts', /renderInvitationQrPng\(\{[^}]*\blook\b/s],
  ['app/dashboard/[eventId]/invitation/page.tsx', /renderInvitationQrSvg\(\{[^}]*\blook\b/s],
  ['app/dashboard/[eventId]/invitation/print/page.tsx', /renderInvitationQrSvg\(\{[^}]*\blook\b/s],
  ['app/[slug]/hub/page.tsx', /renderInvitationQrSvg\(\{[^}]*\blook\b/s],
  ['app/[slug]/_lib/loaders.ts', /renderInvitationQrSvg\(\{[^}]*\blook\b/s],
  ['app/[slug]/invite/enter/page.tsx', /renderInvitationQrSvg\(\{[^}]*\blook\b/s],
  ['app/[slug]/_lib/plus-one-seats.server.ts', /renderInvitationQrSvg\(\{[^}]*\blook\b/s],
  ['lib/print-set.server.ts', /renderInvitationQrPng\(\{[^}]*\blook\b/s],
  ['lib/print-set.server.ts', /renderEventLandingQrPng\(\{[^}]*\blook\b/s],
  ['app/dashboard/[eventId]/seating/print/route.ts', /renderStyledUrlQr(?:Png|Svg)\([^)]*\blook\b/s],
  ['lib/seating-pdf.ts', /renderStyledUrlQrPng\([^)]*\bqrLook\b/s],
  ['app/dashboard/[eventId]/studio/mood-board/concept-pdf/route.ts', /renderStyledUrlQrPng\([\s\S]*?,\s*look,/],
  // The panel already measured Pro on its own read, so it composes the look
  // inline (`qrLookFromRow(lookRow, ownsPro)`) instead of a `look` const.
  ['app/dashboard/[eventId]/guests/invite/_components/invite-panel.tsx', /renderStyledUrlQrSvg\([\s\S]*?qrLookFromRow\(/],
  ['app/[slug]/print/page.tsx', /renderStyledUrlQrSvg\([^)]*\blook\b/s],
];

test('every guest-facing QR surface hands the renderer the event\'s look', () => {
  for (const [file, call] of GUEST_QR_SURFACES) {
    const src = read(file);
    assert.match(src, call, `${file}: a guest QR is drawn without the event's look`);
    assert.ok(!/QRCode\.to(?:DataURL|Buffer|String)\(/.test(src), `${file}: still calls the bare qrcode renderer for a guest code`);
    assert.ok(!/renderBrandedInvitationQr|resolveBrandedQrColors/.test(src), `${file}: still reaches for the retired branded renderers`);
  }
  // And the retired API is gone from lib/qr.ts itself, not merely unused.
  const qr = read('lib/qr.ts');
  assert.ok(!/renderBrandedInvitationQr|resolveBrandedQrColors|monogram\?:/.test(qr), 'lib/qr.ts still exports the pre-Pro API');
});
