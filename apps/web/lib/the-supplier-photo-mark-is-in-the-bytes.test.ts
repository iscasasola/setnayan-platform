/**
 * 🔏 THE NEW SUPPLIER PHOTO MARK IS IN THE STORED BYTES — and its QR SCANS (owner-approved 2026-11-15, DECISION_LOG
 * "APPROVED — THE NEW SUPPLIER PHOTO MARK, APP-WIDE" + "THE PHOTO-MARK QR GOES ON EVERY SHOP'S PHOTOS, VERIFIED OR
 * NOT"; reference `prototypes/supplier_photo_mark_qr_2026-11-15`, `corners()` LAY 'b' + `paintCorners()`).
 *
 * THE CLAIM, TESTED AS A CLAIM — not "the layout has a qr field":
 *   §1 the QR burned into a real photo by the server painter DECODES (the repo's own detector) to
 *      https://www.setnayan.com/{slug} — for a verified shop AND a not-yet-verified one, on a flat and a busy photo
 *   §2 a QR is drawn only at ≥ 3 px per module, inside a 4-module quiet zone, ~22% of the short side
 *   §3 under 180 px the mark is the address only (no logo, no SETNAYAN, no QR)
 *   §4 the shop's logo circle is VERIFIED-ONLY — derived from the shop's own row, never from a browser
 *   §5 the address line reads setnayan.com/{slug} for EVERY shop (no /v/), the same address the QR carries
 *   §6 the mark is a row on a fade — no plate, no pill, no shop-name line, no SETNAYAN VERIFIED
 *   §7 one mark on both paths: the browser painter draws the same layout the server draws (it cannot run under node,
 *      so its drawing of the QR is pinned to the same grid, quiet zone and unit)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { stripComments } from './strip-comments';
import { decodeQrPayloadFromImage } from './qr-decode';
import { isRowLayout, layoutMark, layoutMarkInFrame, rowQrUnit, QR_MIN_UNIT, QR_QUIET, ROW_MIN, type RowLayout } from './photo-mark-geometry';
import { markOverlaySvgForLayout, markPhotoBytes, serverMeasure } from './photo-mark-server';
import { shopMarkFromRow } from './supplier-mark-spec.server';
import { markQr } from './photo-mark-qr';
import { markVerifiedAddress, markQrUrl } from './watermark-text';
import { myPageUrl, ownPageUrl } from './supplier-qr-codes';

const NOW = new Date('2026-11-15T00:00:00Z');
const row = (over: Record<string, string | null> = {}) => ({
  business_name: 'Liwanag Lights & Sound',
  business_slug: 'testnayanw1lights',
  logo_url: 'r2://setnayan-media/vendors/x/logo.png',
  verification_state: 'verified',
  next_renewal_due_at: '2027-11-15T00:00:00Z',
  ...over,
});
const VERIFIED = shopMarkFromRow(row(), NOW).spec;
const UNVERIFIED = shopMarkFromRow(row({ verification_state: 'unverified' }), NOW).spec;
const URL = 'https://www.setnayan.com/testnayanw1lights?via=photo';

async function flat(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 128, g: 128, b: 128 } } }).jpeg({ quality: 95 }).toBuffer();
}

/** A busy photo: stripes and blocks of every brightness, so the QR has to stand on its own tile. */
async function busy(w: number, h: number): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 3;
      const v = ((x >> 3) ^ (y >> 3)) & 1 ? 230 : 25;
      raw[i] = (v + x) & 255;
      raw[i + 1] = v;
      raw[i + 2] = (v + y) & 255;
    }
  }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
}

/** Decode only the QR's own tile — so the test reads THE QR the mark drew, not anything else in the frame. */
async function decodeTile(bytes: Buffer, l: RowLayout): Promise<string | null> {
  const q = l.qr!;
  const pad = Math.round(q.unit * 2);
  const tile = await sharp(bytes)
    .extract({ left: Math.max(0, q.x0 - pad), top: Math.max(0, q.y0 - pad), width: q.side + 2 * pad, height: q.side + 2 * pad })
    .png()
    .toBuffer();
  return decodeQrPayloadFromImage(new Uint8Array(tile));
}

test('§1 the burned QR decodes to https://www.setnayan.com/{slug} — verified and not, flat and busy photos', async () => {
  for (const [name, spec] of [['verified', VERIFIED], ['not verified', UNVERIFIED]] as const) {
    for (const [kind, make] of [['flat', flat], ['busy', busy]] as const) {
      for (const [w, h] of [[1600, 1200], [1080, 1440], [1200, 1200]] as const) {
        const out = await markPhotoBytes(await make(w, h), spec, { logoPng: null });
        assert.ok(isRowLayout(out.layout) && out.layout.qr, `${name} ${kind} ${w}×${h}: no QR drawn`);
        const decoded = await decodeTile(out.bytes, out.layout as RowLayout);
        assert.equal(decoded, URL, `${name} ${kind} ${w}×${h}: the burned QR does not scan to the shop's address`);
      }
    }
  }
  // …and the whole photo, as a phone would see it, finds the same address.
  const whole = await markPhotoBytes(await flat(1600, 1200), UNVERIFIED);
  assert.equal(await decodeQrPayloadFromImage(new Uint8Array(whole.bytes)), URL);
});

test('§2 a QR only at ≥ 3 px per module, in a 4-module quiet zone, ~22% of the short side', () => {
  const n = markQr('testnayanw1lights').modules.length;
  let seenNone = false;
  let seenSome = false;
  for (let S = ROW_MIN; S <= 4000; S += 7) {
    const l = layoutMark(S, Math.round(S * 1.33), VERIFIED, serverMeasure);
    assert.ok(isRowLayout(l));
    const fit = rowQrUnit(S, n);
    if (!l.qr) {
      seenNone = true;
      assert.equal(fit, null, `S=${S}: a QR that could be drawn at ≥ 3 px was left out`);
      continue;
    }
    seenSome = true;
    assert.ok(l.qr.unit >= QR_MIN_UNIT, `S=${S}: QR drawn at ${l.qr.unit} px per module`);
    assert.equal(l.qr.side, l.qr.unit * (n + 2 * QR_QUIET), `S=${S}: the quiet zone is not 4 modules`);
    // ~22% of the short side, snapped DOWN to whole pixels per module (the prototype's `qr()`): never larger than the
    // 22% box, and smaller by less than one module-row of the grid.
    const box = Math.round(0.22 * S);
    assert.ok(l.qr.side <= box && l.qr.side > box - (n + 2 * QR_QUIET), `S=${S}: QR side ${l.qr.side} is not ~22% (${box}) of ${S}`);
  }
  assert.ok(seenNone && seenSome, 'both sides of the 3-px rule must be exercised');
});

test('§3 under 180 px the mark is the address only', () => {
  for (const S of [40, 90, 120, 160, 179]) {
    const l = layoutMark(S, S, VERIFIED, serverMeasure);
    assert.ok(isRowLayout(l));
    assert.equal(l.tier, 'row-text', `S=${S}`);
    assert.equal(l.qr, null);
    assert.equal(l.logo, null);
    assert.equal(l.word, null);
    assert.equal(l.coin, null);
    assert.match(l.address.text, /^setnayan\.com/);
  }
  assert.equal(layoutMark(180, 180, VERIFIED, serverMeasure).tier, 'row');
});

test('§4 the shop’s logo circle is verified-only — from the shop’s own row', () => {
  assert.equal(VERIFIED.kind === 'supplier' && VERIFIED.hasLogo, true);
  assert.equal(UNVERIFIED.kind === 'supplier' && UNVERIFIED.hasLogo, false, 'an unverified shop with a logo must not get the circle');
  const expired = shopMarkFromRow(row({ next_renewal_due_at: '2026-01-01T00:00:00Z' }), NOW).spec;
  assert.equal(expired.kind === 'supplier' && expired.hasLogo, false, 'a lapsed verification takes the circle away');
  const v = layoutMark(1600, 1200, VERIFIED, serverMeasure) as RowLayout;
  const u = layoutMark(1600, 1200, UNVERIFIED, serverMeasure) as RowLayout;
  assert.ok(v.coin, 'a verified shop with a logo draws the circle');
  assert.equal(u.coin, null, 'an unverified shop draws no circle');
  assert.ok(u.qr && v.qr, 'both get the QR');
});

test('§5 the address reads setnayan.com/{slug} for EVERY shop — no /v/ — and the QR opens that address', () => {
  assert.equal(markVerifiedAddress('bloom'), 'setnayan.com/bloom');
  assert.equal(markQrUrl('bloom'), 'https://www.setnayan.com/bloom?via=photo');
  for (const spec of [VERIFIED, UNVERIFIED]) {
    const l = layoutMark(1600, 1200, spec, serverMeasure) as RowLayout;
    assert.equal(l.address.text, 'setnayan.com/testnayanw1lights');
    assert.equal(l.qr!.url, URL);
  }
  assert.doesNotMatch(stripComments(read('lib/watermark-text.ts')), /\/v\/\$\{slug\}/, 'the mark’s address went back to /v/');
});

test('§5b the photo QR is ?via=photo and carries NO src tag — a scan from a photo is Setnayan-sourced (owner 16 Nov, DECISION_LOG b95998b3 + b8d39503)', async () => {
  // Owner, verbatim: "The qr codes on photos will have the no tag. Because this is from setnayan". A couple who scans a
  // shop's photo arrives untagged by src → shop_page → the booking fee applies and the booking counts. It carries
  // via=photo (which material), never ?src=own; the shop's OWN codes (QR, door sticker, Share link) stay ?src=own via
  // ownPageUrl, and the photo mark must never use it.
  const origin = 'https://www.setnayan.com';
  const check = (url: string) => {
    const u = new globalThis.URL(url);
    assert.equal(u.searchParams.get('via'), 'photo', `the photo QR names its material: ${url}`);
    assert.equal(u.searchParams.has('src'), false, `the photo QR carries src: ${url}`);
    assert.deepEqual([...u.searchParams.keys()], ['via'], `only via, nothing else: ${url}`);
  };
  for (const slug of ['bloom', 'testnayanw1lights', 'bloom-vine']) {
    const url = markQr(slug).url;
    check(url);
    const u = new globalThis.URL(url);
    assert.equal(`${u.origin}${u.pathname}`, myPageUrl(origin, slug), 'the photo QR opens the plain myPageUrl page');
    assert.notEqual(url, ownPageUrl(origin, slug));
  }
  // …and the burned pixels agree: what a phone reads off the photo is via=photo with no src.
  for (const spec of [VERIFIED, UNVERIFIED]) {
    const out = await markPhotoBytes(await flat(1600, 1200), spec, { logoPng: null });
    const scanned = await decodeQrPayloadFromImage(new Uint8Array(out.bytes));
    assert.ok(scanned, 'the burned QR decodes');
    check(scanned!);
  }
  // …and nothing on the photo-mark path can reach the supplier's own tagged link.
  for (const f of ['lib/photo-mark-qr.ts', 'lib/watermark-text.ts', 'lib/supplier-mark-spec.server.ts', 'lib/photo-mark-geometry.ts', 'lib/photo-mark-server.ts', 'lib/photo-mark-canvas.ts']) {
    const src = stripComments(read(f));
    assert.doesNotMatch(src, /\bownPageUrl\b|\bOWN_LINK_SRC\b|src=own/, `${f} reaches the supplier's own ?src=own link`);
  }
});

test('§6 a row on a fade — no plate, no shop-name line, no SETNAYAN VERIFIED', async () => {
  const l = layoutMark(1600, 1200, VERIFIED, serverMeasure) as RowLayout;
  assert.equal(l.word!.text, 'SETNAYAN');
  const svg = markOverlaySvgForLayout(1600, 1200, l, null);
  assert.doesNotMatch(svg, /<text\b/, 'the server never asks the host for a font');
  assert.doesNotMatch(svg, /rx="[^"]+"[^>]*fill="rgb\(20,18,16\)"/, 'the old plate is back');
  assert.ok(!JSON.stringify(l).includes('Liwanag'), 'the shop-name line is back on the mark');
  assert.ok(!JSON.stringify(l).includes('VERIFIED'), 'SETNAYAN VERIFIED is back on the mark');
  // The fade darkens the bottom edge and leaves the top of the photo alone.
  const out = await markPhotoBytes(await flat(1600, 1200), VERIFIED);
  const { data, info } = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => data[(y * info.width + x) * info.channels]!;
  assert.ok(px(10, info.height - 3) < 70, `the bottom edge should be faded dark, got ${px(10, info.height - 3)}`);
  assert.ok(Math.abs(px(10, 10) - 128) < 6, 'the top of the photo is untouched');
});

test('§6 every row stays inside its photo and its frame, at every size', () => {
  for (const spec of [VERIFIED, UNVERIFIED]) {
    for (let S = 40; S <= 4000; S += 53) {
      for (const [w, h] of [[S, S], [Math.round(S * 1.6), S], [S, Math.round(S * 1.4)]] as const) {
        const l = layoutMark(w, h, spec, serverMeasure) as RowLayout;
        for (const b of [l.qr && { x: l.qr.x0, y: l.qr.y0, s: l.qr.side }].filter(Boolean) as { x: number; y: number; s: number }[]) {
          assert.ok(b.x >= l.safe.left - 0.5 && b.y + b.s <= l.safe.top + l.safe.size + 0.5, `${w}×${h}: the QR leaves the square`);
        }
      }
    }
    for (const shape of ['square', 'wide'] as const) {
      const frame = { left: 37, top: 13, width: 1400, height: shape === 'wide' ? 560 : 1400 };
      const l = layoutMarkInFrame(frame, shape, spec, serverMeasure) as RowLayout;
      assert.ok(l.fade.left === frame.left && l.fade.width === frame.width, `${shape}: the fade spans the whole frame`);
    }
  }
});

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

test('§7 one mark on both paths — the browser painter draws the same grid, quiet zone and unit', () => {
  const canvas = stripComments(read('lib/photo-mark-canvas.ts'));
  assert.match(canvas, /if \(isRowLayout\(l\)\) \{\s*paintRow\(ctx, l, logo\);/);
  assert.match(canvas, /ctx\.fillRect\(x0 \+ \(c \+ QR_QUIET\) \* unit, y0 \+ \(r \+ QR_QUIET\) \* unit, unit, unit\)/);
  const server = stripComments(read('lib/photo-mark-server.ts'));
  assert.match(server, /\(c \+ QR_QUIET\) \* unit\}/);
  // The QR is made in ONE place, on the server, and travels in the spec — the browser carries no encoder.
  for (const f of ['lib/photo-mark-canvas.ts', 'lib/photo-mark-geometry.ts', 'lib/watermark.ts']) {
    assert.doesNotMatch(stripComments(read(f)), /from 'qrcode'|import\('qrcode'\)/, `${f} pulls a QR encoder into the browser`);
  }
  assert.match(stripComments(read('lib/supplier-mark-spec.server.ts')), /qr: slug \? markQr\(slug\) : null/);
});
