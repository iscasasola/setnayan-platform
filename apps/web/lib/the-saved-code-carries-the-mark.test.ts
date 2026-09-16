/**
 * lib/the-saved-code-carries-the-mark.test.ts — owner decision #19 (2026-09-16):
 * the SAVED QR image carries the couple's monogram.
 *
 * ── WHAT THESE ASSERTIONS REFUSE TO BE ────────────────────────────────────
 * Not "a flag was set". Not "an option was passed". Not "the bytes differ" —
 * the same input through a different codec changes every byte while the ink is
 * identical, and this repo has shipped that mistake before ("a flag in an object
 * is not ink in the pixels"). Not a perceptual hash either: a QR is low-detail
 * and a pHash of one is unstable against its own re-encode.
 *
 * So: two renders of the SAME code, one with the mark and one without, both
 * decoded to RAW pixels, compared PER REGION. The centre must differ. A corner
 * must be byte-for-byte identical. And the ink colours the couple chose must
 * actually be COUNTABLE inside the badge — a blank cream disc would satisfy
 * "the centre changed", and a blank cream disc is exactly what a failed font
 * lookup produces.
 *
 * ⚠ The raw buffer is indexed by hand rather than through `sharp().extract()`:
 * `.stats()` IGNORES a preceding `.extract()`, so an image guard built that way
 * returns identical numbers for every region and can never go red. Nothing here
 * calls either one.
 *
 * ── AND IT STILL HAS TO SCAN ──────────────────────────────────────────────
 * 75 of the 77 guests on one live wedding have neither an email address nor a
 * mobile number. They cannot be sent a link, so a code that photographs
 * beautifully and scans to nothing is worse than a plain one. Every composited
 * PNG here is DECODED with the repo's own detector and must yield the same url
 * the plain code does — including after the downscale-and-recompress a
 * messaging app inflicts on it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  buildEventLandingUrl,
  buildInvitationUrl,
  renderBrandedInvitationQrPng,
  renderEventLandingQrPng,
  renderInvitationQrPng,
  renderInvitationQrSvg,
  resolveBrandedQrColors,
} from '@/lib/qr';
import { decodeQrPayloadFromImage } from '@/lib/qr-decode';
import { monogramOverlaySvg, resolveMonogram, type MonogramConfig } from '@/lib/monogram';
import { fontFileForStack, monogramBadgeSvgDocument } from '@/lib/qr-monogram-raster';
import { stripComments } from '@/lib/strip-comments';

const P = { appUrl: 'https://x.test', slug: 'ana-at-marco', qrToken: 'tok-abc' };

const INK = '#5C2542'; // mulberry — the lockup ink resolveMonogramDesign hands back
const RING = '#C97B4B'; // terracotta — the couple's accent, drawn as the badge ring

function monoFor(style: string | null, fontKey: string | null = 'cormorant'): MonogramConfig {
  return resolveMonogram({
    display_name: 'Maria & Juan',
    monogram_text: null,
    monogram_color: RING,
    monogram_font_key: fontKey,
    monogram_style: style,
    monogram_frame_key: null,
  });
}

type Raw = { data: Buffer; w: number; h: number; ch: number };

async function toRaw(png: Buffer): Promise<Raw> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

/** Mean absolute RGB deviation between the same rectangle of two images. */
function regionDeviation(a: Raw, b: Raw, box: Box): number {
  assert.equal(a.w, b.w);
  assert.equal(a.h, b.h);
  let sum = 0;
  let n = 0;
  for (let y = box.y0; y < box.y1; y += 1) {
    for (let x = box.x0; x < box.x1; x += 1) {
      const i = (y * a.w + x) * a.ch;
      sum += Math.abs(a.data[i]! - b.data[i]!);
      sum += Math.abs(a.data[i + 1]! - b.data[i + 1]!);
      sum += Math.abs(a.data[i + 2]! - b.data[i + 2]!);
      n += 3;
    }
  }
  return n ? sum / n : 0;
}

type Box = { x0: number; y0: number; x1: number; y1: number };

/** Fraction of the QR's side, so the boxes track any render width. */
function box(w: number, fx0: number, fy0: number, fx1: number, fy1: number): Box {
  return {
    x0: Math.round(w * fx0),
    y0: Math.round(w * fy0),
    x1: Math.round(w * fx1),
    y1: Math.round(w * fy1),
  };
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** How many pixels in `box` sit within `tol` of `hex` on every channel. */
function countNear(img: Raw, hex: string, tol: number, b: Box): number {
  const [r, g, bl] = hexRgb(hex);
  let n = 0;
  for (let y = b.y0; y < b.y1; y += 1) {
    for (let x = b.x0; x < b.x1; x += 1) {
      const i = (y * img.w + x) * img.ch;
      if (
        Math.abs(img.data[i]! - r) <= tol &&
        Math.abs(img.data[i + 1]! - g) <= tol &&
        Math.abs(img.data[i + 2]! - bl) <= tol
      ) {
        n += 1;
      }
    }
  }
  return n;
}

// ── The mark is in the PIXELS ───────────────────────────────────────────────

test('the saved PNG differs from the plain one AT THE CENTRE and nowhere else', async () => {
  const plain = await renderInvitationQrPng(P);
  const marked = await renderInvitationQrPng({
    ...P,
    monogram: monoFor('bar'),
    onMonogramError: (e) => assert.fail(`the badge failed to composite: ${String(e)}`),
  });

  const a = await toRaw(plain);
  const b = await toRaw(marked);
  assert.equal(a.w, b.w, 'the mark must not change the file size on disk-pixels');

  // CENTRE — inside the badge circle (r ≈ 0.135·w), comfortably.
  const centre = regionDeviation(a, b, box(a.w, 0.44, 0.44, 0.56, 0.56));
  assert.ok(
    centre > 20,
    `the centre of the saved code is unchanged (mean |Δ| = ${centre.toFixed(2)}/255) — ` +
      'the monogram was not drawn into the pixels',
  );

  // CORNERS — the flat control. The badge is centred, so every finder pattern
  // must come through untouched. A "fix" that draws the mark in the corner, or
  // that re-encodes the whole image, fails HERE and not in the centre check.
  for (const [name, b4] of [
    ['top-left', box(a.w, 0.05, 0.05, 0.28, 0.28)],
    ['top-right', box(a.w, 0.72, 0.05, 0.95, 0.28)],
    ['bottom-left', box(a.w, 0.05, 0.72, 0.28, 0.95)],
  ] as const) {
    const d = regionDeviation(a, b, b4);
    assert.equal(d, 0, `the ${name} corner changed (mean |Δ| = ${d}) — the badge is not centred`);
  }
});

test('the badge is the couple’s INK, not a blank cream disc', async () => {
  // The failure this refuses: sharp renders the shapes, the glyph lookup finds
  // no font, and the couple saves a QR with an empty circle punched in it. Every
  // "the centre changed" assertion stays green through that.
  const marked = await renderInvitationQrPng({ ...P, monogram: monoFor('bar') });
  const img = await toRaw(marked);
  const inner = box(img.w, 0.40, 0.40, 0.60, 0.60);

  const ink = countNear(img, INK, 24, inner);
  assert.ok(
    ink > 2000,
    `only ${ink} mulberry pixels inside the badge — the letters did not draw. ` +
      'On Vercel this is what a failed librsvg font lookup looks like.',
  );

  const ring = countNear(img, RING, 24, box(img.w, 0.30, 0.30, 0.70, 0.70));
  assert.ok(ring > 2000, `only ${ring} accent-ring pixels — the badge ring did not draw`);
});

test('a DIFFERENT couple gets a different mark in the same code', async () => {
  // Pins the badge to the event rather than to a constant: a hard-coded mark
  // would pass every test above.
  const one = await renderInvitationQrPng({ ...P, monogram: monoFor('bar') });
  const two = await renderInvitationQrPng({
    ...P,
    monogram: resolveMonogram({
      display_name: 'Rosa & Teodoro',
      monogram_text: null,
      monogram_color: RING,
      monogram_font_key: 'cormorant',
      monogram_style: 'bar',
      monogram_frame_key: null,
    }),
  });
  const a = await toRaw(one);
  const b = await toRaw(two);
  const centre = regionDeviation(a, b, box(a.w, 0.44, 0.44, 0.56, 0.56));
  assert.ok(centre > 5, `two different couples drew the same centre (|Δ| = ${centre.toFixed(2)})`);
});

test('no monogram supplied → byte-identical to the code this route has always served', async () => {
  // The degrade path. A caller that cannot resolve branding must still get a
  // working QR, and must not get a silently different one.
  const before = await renderInvitationQrPng(P);
  const after = await renderInvitationQrPng({ ...P, monogram: undefined });
  assert.ok(before.equals(after));
});

// ── And it still scans ──────────────────────────────────────────────────────

test('every composited PNG decodes to the SAME url as the plain code', async () => {
  const expected = buildInvitationUrl(P);
  assert.equal(await decodeQrPayloadFromImage(await renderInvitationQrPng(P)), expected);

  for (const style of ['bar', 'duo', 'script', 'infinity', 'framed', null]) {
    const png = await renderInvitationQrPng({ ...P, monogram: monoFor(style) });
    const got = await decodeQrPayloadFromImage(png);
    assert.equal(got, expected, `the ${style ?? 'legacy-initials'} badge broke the code`);
  }
});

test('the branded (palette-tinted) PNG carries the mark and still decodes', async () => {
  const colors = resolveBrandedQrColors('#2F4858');
  const plain = await renderBrandedInvitationQrPng({ ...P, colors });
  const marked = await renderBrandedInvitationQrPng({ ...P, colors, monogram: monoFor('script') });

  const a = await toRaw(plain);
  const b = await toRaw(marked);
  const centre = regionDeviation(a, b, box(a.w, 0.44, 0.44, 0.56, 0.56));
  assert.ok(centre > 20, `the branded PNG's centre is unchanged (|Δ| = ${centre.toFixed(2)})`);
  assert.equal(regionDeviation(a, b, box(a.w, 0.05, 0.05, 0.28, 0.28)), 0);
  assert.equal(await decodeQrPayloadFromImage(marked), buildInvitationUrl(P));
});

test('the master event QR PNG carries the mark and still decodes', async () => {
  const params = { appUrl: P.appUrl, slug: P.slug };
  const plain = await renderEventLandingQrPng(params);
  const marked = await renderEventLandingQrPng({ ...params, monogram: monoFor('duo') });
  const a = await toRaw(plain);
  const b = await toRaw(marked);
  assert.ok(regionDeviation(a, b, box(a.w, 0.44, 0.44, 0.56, 0.56)) > 20);
  assert.equal(await decodeQrPayloadFromImage(marked), buildEventLandingUrl(params));
});

test('it survives what a messaging app does to it', async () => {
  // The realistic journey: saved, sent through a chat that downscales and
  // re-encodes as JPEG, screenshotted at a venue door.
  const marked = await renderInvitationQrPng({ ...P, monogram: monoFor('bar') });
  const mangled = await sharp(marked).resize(360, 360).jpeg({ quality: 70 }).toBuffer();
  assert.equal(await decodeQrPayloadFromImage(mangled), buildInvitationUrl(P));
});

// ── The rasterised badge never asks the host for a font ─────────────────────

test('the SVG handed to sharp contains NO text element and NO font-family', async () => {
  // THE GUARD THAT MATTERS MOST, because its failure is invisible. librsvg's
  // fontconfig path is flaky on Vercel (lib/social/card.tsx, lib/watermark-server.ts):
  // a `<text>` badge can draw perfectly here and draw NOTHING on a lambda, and
  // every pixel assertion above would still pass locally. Outlines or nothing.
  for (const style of ['bar', 'duo', 'script', 'infinity', 'framed', null]) {
    const doc = monogramBadgeSvgDocument(1024, monoFor(style));
    assert.ok(!doc.includes('<text'), `the ${style ?? 'initials'} badge rasterises a <text> element`);
    assert.ok(
      !doc.includes('font-family'),
      `the ${style ?? 'initials'} badge asks the host for a font-family`,
    );
    assert.ok(doc.includes('<path'), `the ${style ?? 'initials'} badge drew no glyph outlines`);
  }
});

test('every face in the registry has a real TTF behind it', async () => {
  // A missing file is an ENOENT at render time — i.e. on a guest's download,
  // for one couple, in production. Cheaper to fail here.
  const stacks = [
    "var(--font-display), 'Cormorant Garamond', Georgia, serif",
    "var(--font-playfair), 'Playfair Display', Georgia, serif",
    "var(--font-cinzel), 'Cinzel', Georgia, serif",
    "var(--font-script), 'Great Vibes', 'Snell Roundhand', cursive",
    "var(--font-libre-caslon), 'Libre Caslon Display', Georgia, serif",
    "var(--font-tangerine), 'Tangerine', 'Snell Roundhand', cursive",
    "var(--font-luxurious), 'Luxurious Script', 'Snell Roundhand', cursive",
    "var(--font-vidaloka), 'Vidaloka', Georgia, serif",
    undefined, // the legacy no-design event
  ];
  const seen = new Set<string>();
  for (const stack of stacks) {
    const file = fontFileForStack(stack);
    seen.add(file);
    assert.ok(
      existsSync(path.join(process.cwd(), file)),
      `${file} (for ${stack ?? 'the legacy default'}) is not in the repo`,
    );
  }
  assert.ok(seen.size >= 8, `the faces collapsed onto ${seen.size} files — a mapping was dropped`);
});

// ── The on-screen SVG is unchanged ──────────────────────────────────────────

test('the browser badge is still a real <text> element in the couple’s webfont', async () => {
  // The raster path must not have cost the on-screen surfaces their live font.
  const overlay = monogramOverlaySvg({ viewBoxSize: 41, monogram: monoFor('bar') });
  assert.ok(overlay.includes('<text'));
  assert.ok(overlay.includes('var(--font-display)'));

  const svg = await renderInvitationQrSvg({ ...P, monogram: monoFor('bar') });
  assert.ok(svg.includes('<text'), 'the on-screen QR lost its live monogram');
});

// ── Every route that SERVES a saved QR actually passes the mark ─────────────

test('all three PNG routes pass a resolved monogram to the renderer', async () => {
  // The lib guards above prove the compositor works. They cannot see a route
  // that stops calling it — and a route is where this regressed for months, not
  // the renderer. Comments are stripped first: this is a POSITIVE assertion, and
  // every one of these files has the word "monogram" in its docblock.
  const routes = [
    'app/api/guest/qr/route.ts',
    'app/api/website/qr/[slug]/route.ts',
    'app/api/website/qr/guest/[guestId]/route.ts',
  ];
  for (const rel of routes) {
    const src = stripComments(readFileSync(path.join(process.cwd(), rel), 'utf8'));
    assert.ok(
      src.includes('resolveMonogram('),
      `${rel} no longer resolves the couple's monogram — the saved image lost the mark`,
    );
    // Slice the RENDERER CALL, not the file: "the word monogram appears
    // somewhere" is satisfied by the const that is then never passed, which is
    // exactly the shape this guard exists to catch.
    const at = src.search(/render\w*QrPng\(\{/);
    assert.notEqual(at, -1, `${rel} does not call a PNG renderer from lib/qr.ts`);
    const call = src.slice(at, src.indexOf('});', at));
    assert.ok(
      /\bmonogram\b\s*[,:]/.test(call),
      `${rel} resolves a monogram but does not hand it to the renderer`,
    );
  }
});

test('no PNG route hand-rolls its own QRCode.toBuffer', async () => {
  // Two of these used to. That is how one surface keeps the mark and another
  // loses it: the badge lives in the renderer, so a route that bypasses the
  // renderer bypasses the badge — and nothing about it looks wrong.
  for (const rel of [
    'app/api/guest/qr/route.ts',
    'app/api/website/qr/[slug]/route.ts',
    'app/api/website/qr/guest/[guestId]/route.ts',
  ]) {
    const src = stripComments(readFileSync(path.join(process.cwd(), rel), 'utf8'));
    assert.ok(
      !src.includes('QRCode.toBuffer'),
      `${rel} renders its own QR instead of calling lib/qr.ts — it will drift`,
    );
  }
});

// ── A badge that did not draw must not look like one that did ───────────────

test('every PNG route reports on the WIRE whether the mark is actually there', async () => {
  // WHY THIS EXISTS, measured: the first version of this feature merged, served,
  // and produced the bare code in production on every request — 200, no error,
  // no log line, and the only way to find out was to decode the served bytes and
  // diff them against a control. The compositor's fallback is correct (a guest's
  // scannable code must never fail for a font), but a fallback nobody can see is
  // the failure-looks-like-success disease this repo keeps paying for.
  for (const rel of [
    'app/api/guest/qr/route.ts',
    'app/api/website/qr/[slug]/route.ts',
    'app/api/website/qr/guest/[guestId]/route.ts',
  ]) {
    const src = stripComments(readFileSync(path.join(process.cwd(), rel), 'utf8'));
    assert.ok(
      src.includes('onMonogramError'),
      `${rel} renders the mark with no error handler — a failure there is silent`,
    );
    assert.ok(
      src.includes("'X-Setnayan-Monogram'"),
      `${rel} does not say on the wire whether the mark was composited`,
    );
    assert.ok(
      /markError\s*\?\s*'fallback'\s*:\s*'composited'/.test(src),
      `${rel}'s header does not report the actual outcome`,
    );
  }
});

test('the compositor never returns the bare code without saying so', async () => {
  // The early return for a non-square input used to be a quiet `return qrPng`.
  // Every QR this repo renders is square, so that branch could only ever fire on
  // a real anomaly — and it reported it as success.
  const src = stripComments(readFileSync(path.join(process.cwd(), 'lib/qr-monogram-raster.ts'), 'utf8'));
  const at = src.indexOf('export async function compositeMonogramOntoQrPng');
  assert.notEqual(at, -1);
  const body = src.slice(at);
  const returns = body.match(/return qrPng;/g) ?? [];
  assert.equal(
    returns.length,
    1,
    `compositeMonogramOntoQrPng returns the bare code ${returns.length} times — only the catch may`,
  );
  assert.ok(
    /catch \(err\) \{\s*onError\?\.\(err\);\s*return qrPng;/.test(body),
    'the one bare-code return is not the reported catch',
  );
});

test('sharp is imported statically here — the interop hop is the bug we already paid for', async () => {
  // `(await import('sharp')).default` inside a module that is ITSELF reached by a
  // dynamic import is one interop hop nobody had verified on a lambda, and the
  // whole feature shipped inert behind it. lib/watermark-server.ts and
  // lib/social/card.tsx have rendered through a static `import sharp` in
  // production for months; this file uses that form and must keep using it.
  const src = stripComments(readFileSync(path.join(process.cwd(), 'lib/qr-monogram-raster.ts'), 'utf8'));
  assert.ok(src.includes("import sharp from 'sharp'"), 'sharp is no longer imported statically');
  assert.ok(!/await import\(\s*['"]sharp['"]\s*\)/.test(src), 'sharp went back to a dynamic import');
});
