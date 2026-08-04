/**
 * 🔴 Payment proofs must NEVER reach the public bucket.
 *
 * Both couple payment actions used to carry a legacy fallback: if no
 * `screenshot_ref` was present, they read `formData.get('screenshot')` as a File
 * and piped it through `uploadPublicAsset` — which writes to `setnayan-media`,
 * the one bucket bound to the public R2 host and served UNSIGNED to anyone
 * holding the key. In `orders/actions.ts` that sat three lines below a comment
 * stating payment proofs are "Privacy-critical … never the public `media`
 * bucket".
 *
 * A payment proof is a bank / GCash transfer screenshot: account numbers, account
 * names, sometimes a balance. It belongs in the private thread-files bucket, read
 * only through short-lived presigned GETs.
 *
 * The fallback had no live producer — the app's only `<input name="screenshot">`
 * lives on `papic/order/[token]/page.tsx` and posts to `submitPapicGuestPayment`,
 * which uploads server-side to the private bucket and mints its own ref — so it
 * was a loaded gun rather than a live leak. Deleted 2026-07-30. These tests keep
 * it deleted: the next page to render that field name must not silently publish
 * proofs to the open internet.
 *
 * ⚠ These assertions deliberately match the IMPORT and the CALL, not the bare
 * identifier: the deletion left an explanatory comment naming `uploadPublicAsset`
 * in `orders/actions.ts`, and a substring guard would have fired on our own
 * prose. Matching the syntax keeps the guard at full strength while letting the
 * code explain itself — the same correction made to the Papic retired-strings
 * guard earlier in the same session.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

const PAYMENT_ACTIONS = [
  'dashboard/[eventId]/orders/actions.ts',
  'dashboard/[eventId]/checkout/actions.ts',
] as const;

const read = (rel: string) => readFileSync(join(appDir, rel), 'utf8');

test('neither payment action imports uploadPublicAsset', () => {
  for (const rel of PAYMENT_ACTIONS) {
    const src = read(rel);
    assert.ok(
      !/import\s*\{[^}]*\buploadPublicAsset\b[^}]*\}\s*from/.test(src),
      `${rel} must not import uploadPublicAsset — payment proofs are private`,
    );
  }
});

test('neither payment action CALLS uploadPublicAsset', () => {
  for (const rel of PAYMENT_ACTIONS) {
    const src = read(rel);
    // Strip line and block comments so the deletion note doesn't count.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(
      !/\buploadPublicAsset\s*\(/.test(code),
      `${rel} must not call uploadPublicAsset — that is the public bucket`,
    );
  }
});

test('neither payment action reads the legacy `screenshot` File field', () => {
  for (const rel of PAYMENT_ACTIONS) {
    const src = read(rel);
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // `screenshot_ref` is the sanctioned field and must survive; a bare
    // `get('screenshot')` is the deleted legacy path.
    assert.ok(
      !/formData\.get\(\s*['"]screenshot['"]\s*\)/.test(code),
      `${rel} reintroduced the legacy screenshot File field`,
    );
    assert.match(
      code,
      /formData\.get\(\s*['"]screenshot_ref['"]\s*\)/,
      `${rel} must still read the sanctioned screenshot_ref field`,
    );
  }
});

test('the sanctioned private-bucket ref path is still gated, not just present', () => {
  for (const rel of PAYMENT_ACTIONS) {
    const code = read(rel)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.match(
      code,
      /parseClientRef\(/,
      `${rel}: the surviving ref path must still run through the sanctioned gate (#3925)`,
    );
    assert.match(
      code,
      /(orderPaymentProofPolicy|inlineCheckoutProofPolicy)\(/,
      `${rel}: …bound by a tenanted proof policy`,
    );
  }
});

test('checkout still REJECTS a submit with no usable proof', () => {
  // Removing the fallback must fail loudly, not silently store null: the drawer
  // requires a screenshot, so a submit that produced no valid ref has to tell
  // the buyer rather than proceed.
  const code = read('dashboard/[eventId]/checkout/actions.ts');
  assert.match(
    code,
    /if \(!screenshotUrl\)/,
    'the required-proof reject must survive the fallback deletion',
  );
  assert.match(code, /A payment screenshot is required\./);
});

test('the guest Papic payment path still uploads server-side to the PRIVATE bucket', () => {
  // The one live producer of a `name="screenshot"` File. It never trusted a
  // client ref and must keep uploading to thread-files itself — if this ever
  // moves to uploadPublicAsset, anonymous guests' proofs go public.
  const src = read('papic/buy/actions.ts');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(
    !/\buploadPublicAsset\s*\(/.test(code),
    'the guest payment path must not write proofs to the public bucket',
  );
  assert.match(
    code,
    /R2_BUCKETS\.threadFiles/,
    'the guest payment path must target the private thread-files bucket',
  );
});
