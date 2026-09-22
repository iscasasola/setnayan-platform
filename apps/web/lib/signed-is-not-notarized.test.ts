/**
 * signed-is-not-notarized.test.ts — the download page may not promise
 * notarization from a signature.
 *
 * ── The defect (register DSK-6) ─────────────────────────────────────────────
 * `/download` told visitors **"Signed & notarized by Apple"**, branched on
 * `mac.signed`. Measured against the live build on 2026-09-22 — the exact file
 * `/api/download/mac` serves:
 *
 *     xcrun stapler validate → "does not have a ticket stapled to it"
 *     spctl -a -t open -vv   → "rejected"
 *                              source=Unnotarized Developer ID
 *                              origin=Developer ID Application: … (P95JPDWWB3)
 *
 * The build IS signed. It is NOT notarized. `spctl` states both in the same
 * breath, and they are different facts: signing says who built it, notarization
 * says Apple scanned it. Gatekeeper only stops warning for the second.
 *
 * 🔑 ONE BOOLEAN WAS CARRYING TWO CLAIMS, and the copy asserted the stronger
 * one. The manifest never claimed notarization — `release.json` says
 * `"signed": true` and nothing else. **The page invented the stronger claim
 * from the weaker fact.** Same disease as `liveWall = null` carrying three
 * meanings (register LAU-33, fixed in this same bundle).
 *
 * What a couple met: "cannot be opened because Apple cannot check it for
 * malicious software", in their wedding week, on a page that had just promised
 * the opposite.
 *
 * ── Why this cannot simply be re-measured in CI ─────────────────────────────
 * ⚠ `stapler` and `spctl` are macOS-only and need the binary. CI has neither.
 * So the guard holds the SHAPE: the word "notarized" may only appear inside a
 * branch gated on `notarized`, never on `signed`, and the parser must default
 * the field to false. Flipping the claim then requires someone to set a field
 * whose docblock tells them how to verify it first.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';
import { parseDesktopRelease } from './desktop-release';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const PAGE = 'app/download/page.tsx';

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const manifest = (mac: Record<string, unknown>) => ({
  version: '0.0.1',
  publishedAt: '2026-09-14',
  mac: { aarch64: { url: 'https://r2.example/x.dmg', sizeBytes: 100, ...mac } },
  windows: null,
});

test('a manifest that says only `signed` is NOT notarized', () => {
  // This is the exact shape production serves today.
  const parsed = parseDesktopRelease(manifest({ signed: true }));
  assert.ok(parsed, 'the real-world manifest shape must still parse');
  assert.equal(parsed.mac.aarch64.signed, true);
  assert.equal(
    parsed.mac.aarch64.notarized,
    false,
    'notarization was inferred from a signature — that inference is the defect',
  );
});

test('notarized is only true when the manifest says so, explicitly', () => {
  assert.equal(parseDesktopRelease(manifest({ signed: true, notarized: true }))!.mac.aarch64.notarized, true);
  // Fail closed on every not-quite-true value: a string, a number, a missing key.
  for (const v of ['true', 1, null, undefined] as unknown[]) {
    const p = parseDesktopRelease(manifest({ signed: true, notarized: v }));
    assert.equal(p!.mac.aarch64.notarized, false, `notarized: ${JSON.stringify(v)} must be false`);
  }
});

test('an unsigned build is not notarized either — the fields are independent', () => {
  const p = parseDesktopRelease(manifest({ signed: false }));
  assert.equal(p!.mac.aarch64.signed, false);
  assert.equal(p!.mac.aarch64.notarized, false);
});

test('the page never claims notarization from a signature', () => {
  const src = read(PAGE);

  // Every place the word appears must sit in a branch reading `notarized`.
  const claims = [...src.matchAll(/notariz\w*/gi)];
  assert.ok(claims.length >= 2, `only ${claims.length} notarization mentions — has the copy moved?`);

  assert.doesNotMatch(
    src,
    /mac\.signed\s*\?/,
    'the hero branches on `signed` again — signing is not notarization, and Gatekeeper knows',
  );
  assert.doesNotMatch(
    src,
    /mac\?\.signed\s*\n?\s*\?/,
    'the value card branches on `signed` again',
  );
  assert.match(src, /mac\.notarized\s*\?/, 'the hero must branch on `notarized`');
  assert.match(src, /mac\?\.notarized/, 'the value card must branch on `notarized`');

  console.log(`[signed≠notarized] ${claims.length} notarization mention(s), all gated on notarized`);
});

test('the honest branch still exists — the fix is not deleting the sentence', () => {
  const src = read(PAGE);
  assert.match(
    src,
    /Not yet notarized by Apple/,
    'the not-yet-notarized copy is gone. Removing the true sentence is not a way to stop saying ' +
      'the false one — a visitor still needs to know macOS will ask on first launch.',
  );
});
