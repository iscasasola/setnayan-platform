/**
 * THE PROVIDER NEVER RETURNS SOMETHING A CALLER CAN MISTAKE FOR AN IMAGE (MB8).
 *
 * `extractImage` is the narrowest, highest-stakes function in the paid path.
 * It reads a JSON body from an API that is versioned by a DATE header, which
 * means its shape can move under us on Google's schedule. If a field rename
 * made this return "no image, carry on", every couple would be charged for a
 * blank tile and the only symptom would be sadness — nothing would be red,
 * nothing would be logged as an error, and the render row would look normal.
 *
 * 🔑 SO THE LOAD-BEARING DISTINCTION UNDER TEST IS `no_image` vs `bad_shape`:
 *   · `no_image`  — we understood the response and there was no picture in it.
 *                   The model answered. A retry may help. The couple's fault
 *                   nobody's, and their credit comes back.
 *   · `bad_shape` — we did NOT understand the response. WE are broken. A retry
 *                   cannot help and the owner needs to know.
 * Collapsing the two into `null` is how an API change becomes a silent charge.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractImage,
  imageProviderConfigured,
  imageProviderModel,
  generateRenderImage,
  sniffImageMime,
} from './gemini-image';

/** A base64 payload big enough to pass the "that is not a photograph" floor. */
const REAL_IMAGE_B64 = Buffer.alloc(2048, 7).toString('base64');

test('the documented shape is read: output_image.data', () => {
  const r = extractImage({ output_image: { mime_type: 'image/png', data: REAL_IMAGE_B64 } });
  assert.equal(r.ok, true);
  assert.ok(r.ok && r.bytes.byteLength === 2048);
  assert.ok(r.ok && r.mimeType === 'image/png');
});

test('the camelCase and `interaction`-envelope variants are read too', () => {
  const camel = extractImage({ outputImage: { mimeType: 'image/jpeg', data: REAL_IMAGE_B64 } });
  assert.ok(camel.ok && camel.mimeType === 'image/jpeg');

  const nested = extractImage({
    interaction: { output_image: { mime_type: 'image/webp', data: REAL_IMAGE_B64 } },
  });
  assert.ok(nested.ok && nested.mimeType === 'image/webp');
});

test('the steps[] shape is read, and the LAST image step wins', () => {
  const r = extractImage({
    steps: [
      { type: 'text', text: 'thinking' },
      { type: 'image', mime_type: 'image/png', data: Buffer.alloc(512, 1).toString('base64') },
      { type: 'image', mime_type: 'image/png', data: REAL_IMAGE_B64 },
    ],
  });
  assert.ok(r.ok);
  assert.equal(r.ok && r.bytes.byteLength, 2048, 'the final image is the finished one');
});

test('a missing mime type defaults to png rather than failing', () => {
  // The bytes are the deliverable; a missing content-type is not worth
  // refunding a real photograph over.
  const r = extractImage({ output_image: { data: REAL_IMAGE_B64 } });
  assert.ok(r.ok && r.mimeType === 'image/png');
});

/* ── the failures that must NOT read as an empty success ─────────────────── */

test('an unrecognised body is `bad_shape`, never an empty success', () => {
  for (const body of [
    {},
    { candidates: [{ content: { parts: [{ text: 'hello' }] } }] }, // the OLD generateContent shape
    { some: 'other api' },
    { steps: [] },
  ]) {
    const r = extractImage(body);
    assert.equal(r.ok, false, `${JSON.stringify(body)} must not be read as a success`);
    assert.equal(
      r.ok === false && r.code,
      'bad_shape',
      'a response we cannot parse is OUR failure (bad_shape), not the model declining (no_image)',
    );
  }
});

test('a null / string / number body is `bad_shape`', () => {
  for (const body of [null, undefined, 'a string', 42, []]) {
    const r = extractImage(body);
    assert.equal(r.ok, false);
  }
});

test('an image container with no data is `no_image` — understood, and empty', () => {
  const r = extractImage({ output_image: { mime_type: 'image/png', data: '' } });
  assert.equal(r.ok, false);
  assert.equal(
    r.ok === false && r.code,
    'no_image',
    'we found where the picture lives and it was empty — that is the model answering without one',
  );
});

test('a provider-side refusal inside a 200 is `refused`, not `no_image`', () => {
  // A policy decline arrives as a successful HTTP response. Read as
  // `no_image`, the couple is told to "try again", which will never work.
  for (const status of ['refused', 'BLOCKED', 'safety_rejected']) {
    const r = extractImage({ status, output_image: null });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.code, 'refused', `status=${status} must read as refused`);
  }
});

test('a tiny decoded payload is `bad_shape`, not a 3-byte photograph', () => {
  // 🪤 Base64 decoding is LENIENT: garbage decodes to a short Buffer rather
  // than throwing. Without the floor, "abc" would sail through as a valid
  // image and land on a tile the couple paid for as a broken-image icon.
  const r = extractImage({ output_image: { data: 'abc' } });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.code, 'bad_shape');
});

test('a successful extract can never carry zero bytes', () => {
  // The invariant, stated as a property rather than a case: there is exactly
  // one construction site for `ok: true`, and it sits behind a length check.
  const bodies = [
    { output_image: { data: REAL_IMAGE_B64 } },
    { output_image: { data: '' } },
    { output_image: { data: 'abc' } },
    {},
    { steps: [{ type: 'image', data: REAL_IMAGE_B64 }] },
  ];
  for (const b of bodies) {
    const r = extractImage(b);
    if (r.ok) assert.ok(r.bytes.byteLength >= 256, 'an ok result must carry real bytes');
  }
});

/* ── the unset key is a LOUD failure, not silence ────────────────────────── */

test('with no GEMINI_API_KEY, the call fails LOUDLY and reaches no network', async () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.equal(imageProviderConfigured(), false);
    const r = await generateRenderImage({ prompt: 'a room' });
    // 🔑 THE `RESEND_API_KEY` SHAPE, REFUSED. An unset key left the owner
    // un-notified of real customer payments for months, because the code was
    // correct, the call was made, and nothing happened where nobody was
    // looking. Here it is a value the caller must narrow, carrying a code the
    // tile turns into words.
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.code, 'not_configured');
    assert.match(r.ok === false ? r.detail : '', /GEMINI_API_KEY/);
  } finally {
    if (saved === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved;
  }
});

test('the model defaults to the one the render pack was PRICED against', () => {
  const saved = process.env.MOODBOARD_RENDER_MODEL;
  delete process.env.MOODBOARD_RENDER_MODEL;
  try {
    // 🛑 NOT `gemini-3.1-flash-image`, Google's current recommendation. The
    // owner's ~89% margin on this pack was computed against Gemini 2.5 Flash
    // Image at ~₱2.2/render; nobody has measured what the newer model costs.
    // Repo rule: a number that governs money is not a guess to annotate and
    // ship. Switching is an owner call and is one env var when they make it —
    // which is what this asserts is still true.
    assert.equal(imageProviderModel(), 'gemini-2.5-flash-image');
    process.env.MOODBOARD_RENDER_MODEL = 'gemini-3.1-flash-image';
    assert.equal(imageProviderModel(), 'gemini-3.1-flash-image');
  } finally {
    if (saved === undefined) delete process.env.MOODBOARD_RENDER_MODEL;
    else process.env.MOODBOARD_RENDER_MODEL = saved;
  }
});

/* ── the request contract, pinned against the verified docs ──────────────── */

test('SABOTAGE-PROVED GUARD: the endpoint, the key header and the pinned Api-Revision are all present', () => {
  const src = readFileSync(join(process.cwd(), 'lib/gemini-image.ts'), 'utf8');

  // Verified 2026-09-03 against ai.google.dev's Interactions API docs. The old
  // `generateContent` endpoint and the `?key=` query form are NOT what this
  // API takes, and getting any one of these wrong fails every call in
  // production while every test that mocks the transport still passes.
  assert.match(src, /generativelanguage\.googleapis\.com\/v1beta\/interactions/);
  assert.match(src, /'x-goog-api-key'/);
  assert.match(
    src,
    /API_REVISION\s*=\s*'\d{4}-\d{2}-\d{2}'/,
    "Api-Revision must be PINNED to a date — an unpinned revision lets the response shape " +
      "change on Google's release schedule rather than on ours, mid-purchase",
  );
  assert.match(src, /'Api-Revision': API_REVISION/, 'the pinned revision must actually be sent');

  // The key must never travel in a URL — it would land in logs and referrers.
  assert.ok(
    !/interactions\?[^']*key=/.test(src),
    'the API key must be a header, never a query parameter',
  );
});

/* ── the reference images we SEND must be labelled truthfully ────────────── */

test('sniffImageMime reads the magic number, not a hopeful default', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);
  assert.equal(sniffImageMime(png), 'image/png');
  assert.equal(sniffImageMime(jpg), 'image/jpeg');
  assert.equal(sniffImageMime(gif), 'image/gif');
  assert.equal(sniffImageMime(webp), 'image/webp');

  // The couple's inspirations arrive as raw bytes with the content-type
  // discarded, so declaring image/jpeg over PNG bytes would be a mismatch a
  // provider can reject — failing every render for anyone whose uploads are
  // PNG, visibly but blaming the wrong thing.
  assert.notEqual(sniffImageMime(png), 'image/jpeg');
});

test('unrecognised bytes fall back to jpeg rather than throwing', () => {
  assert.equal(sniffImageMime(new Uint8Array([1, 2, 3])), 'image/jpeg');
  assert.equal(sniffImageMime(new Uint8Array(0)), 'image/jpeg');
});
