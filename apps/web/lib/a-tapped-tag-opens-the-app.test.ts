/**
 * a-tapped-tag-opens-the-app.test.ts — every surface an NFC TAG (or a QR) can
 * carry is claimed by the app on BOTH platforms.
 *
 * ── The defect this pins ───────────────────────────────────────────────────
 * A tag holds a plain https link. Without a claim, tapping it opens the
 * BROWSER even on a phone that has the app — which is what the owner hit on
 * 2026-09-20: his own shop tag opened `/vendor-invite/<slug>` in Safari,
 * because the association file listed only `/dashboard/*` and `/papic/*`.
 *
 * The other half is drift: iOS reads `apple-app-site-association`, Android
 * reads intent filters in its manifest. Two files, one fact. A path added to
 * one and forgotten in the other fails silently on the platform that lost it,
 * so this asserts PARITY, not just presence.
 *
 * 🛡 Mutation-checked: dropping a path from either file goes red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const AASA = join(WEB, 'public/.well-known/apple-app-site-association');
const MANIFEST = join(WEB, '..', 'mobile/android/app/src/main/AndroidManifest.xml');

/** The path prefix each tag-able builder produces, and where it comes from. */
const TAG_SURFACES: { prefix: string; why: string }[] = [
  { prefix: '/vendor-invite/', why: 'the supplier Shortlist QR — buildVendorInviteUrl' },
  { prefix: '/vendor/lock/', why: 'the supplier Locked QR — buildVendorLockUrl' },
  { prefix: '/v/', why: "the supplier's public page + On-the-Day review QR" },
  { prefix: '/join/', why: 'the guest join-link QR' },
  { prefix: '/u/', why: 'a guest invitation + event landing under the nested owner path' },
  { prefix: '/dashboard/', why: 'the couple + supplier app surfaces (pre-existing)' },
  { prefix: '/papic/', why: 'Papic seat claims (pre-existing)' },
];

/** Compare by path only: drop the iOS `*` and any trailing slash. */
function norm(p: string): string {
  return p.replace(/\*$/, '').replace(/\/$/, '');
}

function iosPaths(): string[] {
  const aasa = JSON.parse(readFileSync(AASA, 'utf8'));
  const details = aasa.applinks.details;
  assert.equal(details.length, 1, 'one appID');
  assert.equal(details[0].appID, 'P95JPDWWB3.com.setnayan.app');
  return details[0].paths as string[];
}

function androidPrefixes(): string[] {
  const xml = readFileSync(MANIFEST, 'utf8');
  const verified = xml.match(/<intent-filter android:autoVerify="true">[\s\S]*?<\/intent-filter>/);
  assert.ok(verified, 'the verified App Links intent-filter exists');
  return [...verified[0].matchAll(/android:pathPrefix="([^"]+)"/g)].map((m) => m[1] ?? '');
}

test('every surface a tag can carry is claimed on iPhone', () => {
  const claimed = new Set(iosPaths().map(norm));
  for (const s of TAG_SURFACES) {
    assert.ok(claimed.has(norm(s.prefix)), `iOS does not claim ${s.prefix} — ${s.why}`);
  }
  const paths = iosPaths();
  console.log(`iOS claims ${paths.length} paths: ${paths.join(' ')}`);
});

test('Android claims the same surfaces, so neither platform drifts', () => {
  const droid = androidPrefixes();
  const claimed = new Set(droid.map(norm));
  for (const s of TAG_SURFACES) {
    assert.ok(claimed.has(norm(s.prefix)), `Android does not claim ${s.prefix} — ${s.why}`);
  }
  // Parity, as SETS. A loose "does some prefix look similar?" test passed with
  // /v/ missing, because /vendor-invite starts with /v — so this compares the
  // two lists exactly, normalised only for the trailing slash and the iOS star.
  assert.deepEqual(
    [...claimed].sort(),
    [...new Set(iosPaths().map(norm))].sort(),
    'the two association files claim different surfaces',
  );
  console.log(`Android claims ${droid.length} prefixes: ${droid.join(' ')}`);
});

test('the bare event landing path is deliberately NOT claimed', () => {
  // `/<slug>` (an event site at the root) cannot be expressed without claiming
  // the WHOLE domain — marketing, login, everything. Guests tapping such a tag
  // get the browser, which is correct: most of them do not have the app.
  const paths = iosPaths();
  assert.ok(!paths.includes('/*'), 'claiming the whole domain would swallow marketing + auth');
});
