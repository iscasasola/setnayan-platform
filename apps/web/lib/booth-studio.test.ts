/**
 * Unit suite for Booth Studio's PURE rules (`lib/booth-studio.ts`).
 * Load-bearing invariants:
 *   • sanitizeBoothStudioContent coerces/caps and FAILS SAFE (garbage → null),
 *     so a missing/broken poster never throws into the 3D scene.
 *   • The composed layout is HARMONIZED to the couple's palette (the aesthetic
 *     guard): the accent derives from the palette, a garish vendor accent is
 *     clamped/rejected, and ink stays legible over the board.
 *   • publicPosterAssetUrl NEVER yields a presigned URL — the exact hazard the
 *     corpus warns about (presigned URLs expire inside cached scene payloads).
 *   • resolveBoothStudioContent keeps each booth bound to its OWN vendor's
 *     content + logo — per-(event,vendor) isolation, no cross-contamination.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOOTH_STUDIO_LIMITS,
  BOOTH_STUDIO_CANVAS,
  sanitizeBoothStudioContent,
  composeBoothStudioLayout,
  harmonizeAccent,
  pickReadableInk,
  relativeLuminance,
  publicPosterAssetUrl,
  resolveBoothStudioContent,
  type BoothStudioPalette,
} from './booth-studio';

const PALETTE: BoothStudioPalette = { accent: '#c89b6c', table: '#f3efe9', wall: '#d8cfc2' };

// --- sanitize ---------------------------------------------------------------

test('sanitize trims and keeps present fields', () => {
  const c = sanitizeBoothStudioContent({ headline: '  Bella  Flora  ', offer: 'Free shoot', price: '₱25,000' });
  assert.deepEqual(c, { headline: 'Bella Flora', offer: 'Free shoot', price: '₱25,000' });
});

test('sanitize caps each field to its limit', () => {
  const long = 'x'.repeat(200);
  const c = sanitizeBoothStudioContent({ headline: long });
  assert.ok(c);
  assert.equal(c!.headline!.length, BOOTH_STUDIO_LIMITS.headline);
});

test('sanitize returns null when no text line is present', () => {
  assert.equal(sanitizeBoothStudioContent({ accent: '#ff0000' }), null);
  assert.equal(sanitizeBoothStudioContent({}), null);
  assert.equal(sanitizeBoothStudioContent(null), null);
  assert.equal(sanitizeBoothStudioContent('nope'), null);
  assert.equal(sanitizeBoothStudioContent({ headline: '   ' }), null);
});

test('sanitize keeps a valid accent hex and drops an invalid one', () => {
  assert.equal(sanitizeBoothStudioContent({ headline: 'A', accent: '#abcdef' })!.accent, '#abcdef');
  assert.equal(sanitizeBoothStudioContent({ headline: 'A', accent: 'blue' })!.accent, undefined);
});

// --- harmonize (the aesthetic guard) ----------------------------------------

test('harmonizeAccent falls back to palette accent when absent/invalid', () => {
  assert.equal(harmonizeAccent(null, PALETTE), PALETTE.accent);
  assert.equal(harmonizeAccent('not-a-hex', PALETTE), PALETTE.accent);
});

test('harmonizeAccent rejects a neon/garish accent (falls back to palette)', () => {
  assert.equal(harmonizeAccent('#00ff00', PALETTE), PALETTE.accent); // fully saturated neon
});

test('harmonizeAccent tames a strong-but-plausible accent instead of passing it raw', () => {
  const out = harmonizeAccent('#8a1c2b', PALETTE); // deep saturated red
  assert.notEqual(out, '#8a1c2b');
  assert.match(out, /^#[0-9a-f]{6}$/);
});

// --- compose ----------------------------------------------------------------

test('composeBoothStudioLayout derives colours from the couple palette', () => {
  const layout = composeBoothStudioLayout({ headline: 'Bella Flora', offer: 'Free shoot', price: '₱25,000' }, PALETTE);
  assert.equal(layout.width, BOOTH_STUDIO_CANVAS.w);
  assert.equal(layout.height, BOOTH_STUDIO_CANVAS.h);
  // Accent harmonizes from the palette accent when the vendor gives none.
  assert.equal(layout.accent, harmonizeAccent(undefined, PALETTE));
  // Ink is legible over the board.
  assert.equal(layout.ink, pickReadableInk(layout.bg));
  assert.equal(layout.lines.length, 3);
  assert.deepEqual(layout.lines.map((l) => l.kind), ['headline', 'offer', 'price']);
});

test('composeBoothStudioLayout only emits lines that have content', () => {
  const layout = composeBoothStudioLayout({ headline: 'Solo Headline' }, PALETTE);
  assert.equal(layout.lines.length, 1);
  assert.equal(layout.lines[0]?.kind, 'headline');
});

test('pickReadableInk flips with board luminance', () => {
  assert.equal(relativeLuminance('#ffffff') > 0.5, true);
  assert.notEqual(pickReadableInk('#ffffff'), pickReadableInk('#111111'));
});

// --- publicPosterAssetUrl (never presigned) ---------------------------------

const BASE = 'https://media.setnayan.com';

test('publicPosterAssetUrl resolves a media ref to the PUBLIC host with no signature', () => {
  const url = publicPosterAssetUrl('r2://setnayan-media/vendors/abc/logo/x.png', BASE);
  assert.equal(url, `${BASE}/vendors/abc/logo/x.png`);
  assert.doesNotMatch(url!, /X-Amz-Signature|[?]/); // never presigned, no query string
});

test('publicPosterAssetUrl refuses a private-bucket ref (not publicly served)', () => {
  assert.equal(publicPosterAssetUrl('r2://setnayan-vendor-contracts/x.pdf', BASE), null);
  assert.equal(publicPosterAssetUrl('r2://setnayan-vendor-verification/x.jpg', BASE), null);
});

test('publicPosterAssetUrl passes a plain https legacy url through', () => {
  assert.equal(publicPosterAssetUrl('https://cdn.example.com/logo.png', BASE), 'https://cdn.example.com/logo.png');
});

test('publicPosterAssetUrl REJECTS an already-presigned https url', () => {
  const presigned = 'https://x.r2.cloudflarestorage.com/k?X-Amz-Signature=deadbeef&X-Amz-Expires=86400';
  assert.equal(publicPosterAssetUrl(presigned, BASE), null);
});

test('publicPosterAssetUrl returns null on empty / missing / no-base', () => {
  assert.equal(publicPosterAssetUrl(null, BASE), null);
  assert.equal(publicPosterAssetUrl('   ', BASE), null);
  assert.equal(publicPosterAssetUrl('r2://setnayan-media/x.png', undefined), null);
});

// --- resolveBoothStudioContent (per-event / per-vendor isolation) -----------

test('resolveBoothStudioContent attaches the PUBLIC logo url, never presigned', () => {
  const r = resolveBoothStudioContent(
    { headline: 'Bella Flora' },
    'r2://setnayan-media/vendors/bella/logo/x.png',
    BASE,
  );
  assert.ok(r);
  assert.equal(r!.headline, 'Bella Flora');
  assert.equal(r!.logoPublicUrl, `${BASE}/vendors/bella/logo/x.png`);
});

test('resolveBoothStudioContent yields null for a booth with no usable content', () => {
  assert.equal(resolveBoothStudioContent(null, 'r2://setnayan-media/x.png', BASE), null);
});

test('resolveBoothStudioContent keeps each booth bound to its OWN vendor (no cross-contamination)', () => {
  // Simulate the scene resolver mapping over two booths — A and B must not swap.
  const booths = [
    { id: 'A', content: { headline: 'Studio A' }, logo: 'r2://setnayan-media/a/logo.png' },
    { id: 'B', content: { headline: 'Studio B' }, logo: 'r2://setnayan-media/b/logo.png' },
  ];
  const resolved = booths.map((b) => ({ id: b.id, r: resolveBoothStudioContent(b.content, b.logo, BASE) }));
  const a = resolved[0]?.r;
  const b = resolved[1]?.r;
  assert.equal(a?.headline, 'Studio A');
  assert.equal(a?.logoPublicUrl, `${BASE}/a/logo.png`);
  assert.equal(b?.headline, 'Studio B');
  assert.equal(b?.logoPublicUrl, `${BASE}/b/logo.png`);
});
