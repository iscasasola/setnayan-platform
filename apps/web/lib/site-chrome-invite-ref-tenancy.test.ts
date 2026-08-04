/**
 * SEC-1 lane #2 — the last two stored-ref write paths.
 *
 * 🔴 SITE-CHROME WAS LIVE AND PUBLIC. `site_bg_music_r2_key` and
 * `landing_page_hero_video_r2_key` were validated only by `startsWith('r2://')`,
 * and both are served to the PUBLIC guest site — `[slug]/_lib/loaders.ts:294`
 * signs the music through `displayUrlForStoredAsset`, and `lib/showcase-db.ts`
 * resolves the hero video for the public showcase. So a crafted post could point a
 * wedding's background music at a vendor's `verification/dti.pdf` and the couple's
 * own public site would serve a signed URL to it.
 *
 * 🟡 INVITE PROOFS ARE LATENT. `vendor_locked_qr_tokens.proof_r2_key` is written
 * but — verified by grep — resolved through no signing helper anywhere today. The
 * guard is defence-in-depth so the ref is already trustworthy if a display surface
 * is ever built. That is the cheap half of the #3909/#3911 lesson: the WRITE is
 * where a ref becomes trustworthy, and bolting the pin on after a reader appears
 * is how these become oracles.
 *
 * Both policies already existed or are one-liners; the recurring failure is not
 * missing policies, it is policies not applied at every writer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseClientRef, eventMediaPolicy, lockedQrProofPolicy } from './r2-client-ref';

const EVENT = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const OTHER = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const WEB = dirname(fileURLToPath(import.meta.url)) + '/..';

/* ── site-chrome ────────────────────────────────────────────────────────────── */

test('site-chrome: the real uploads are accepted', () => {
  const policy = eventMediaPolicy(EVENT);
  for (const key of [
    `events/${EVENT}/site-music/track.mp3`,
    `events/${EVENT}/landing-page-hero-video/clip.mp4`,
  ]) {
    assert.ok(parseClientRef(`r2://setnayan-media/${key}`, policy), `${key} is legitimate`);
  }
});

test("🔴 site-chrome: a private-bucket ref can no longer reach the PUBLIC site", () => {
  const policy = eventMediaPolicy(EVENT);
  for (const ref of [
    'r2://setnayan-vendor-verification/vendors/X/verification/dti.pdf',
    'r2://setnayan-thread-files/payments/ORDER/screenshot.png',
    `r2://setnayan-vendor-contracts/paperwork/${EVENT}/psa_birth/scan.pdf`,
  ]) {
    assert.equal(parseClientRef(ref, policy), null, `${ref} must never be servable as site chrome`);
  }
});

test("site-chrome: another event's media is refused", () => {
  assert.equal(
    parseClientRef(`r2://setnayan-media/events/${OTHER}/site-music/track.mp3`, eventMediaPolicy(EVENT)),
    null,
  );
});

test('site-chrome: the WIRING pins BOTH columns, and to the event', () => {
  const src = readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'website', 'site-chrome', 'actions.ts'), 'utf8');
  assert.match(src, /parseClientRef\(v, eventMediaPolicy\(eventId\)\)/, 'the helper must pin to the event');
  assert.match(src, /r2RefOrNull\(formData\.get\('bg_music_url'\), eventId\)/, 'music must be pinned');
  assert.match(src, /formData\.get\('hero_video_url'\),\s*\n?\s*eventId,/, 'hero video must be pinned');
  assert.equal(
    /startsWith\('r2:\/\/'\) \? v : null/.test(src),
    false,
    'the old scheme-only check must be gone, not merely bypassed',
  );
});

/* ── invite proofs (latent) ─────────────────────────────────────────────────── */

test('invite: the real upload prefix is accepted, private buckets are not', () => {
  assert.ok(parseClientRef('r2://setnayan-media/locked-qr-proof/abc.jpg', lockedQrProofPolicy()));
  assert.equal(
    parseClientRef('r2://setnayan-vendor-verification/locked-qr-proof/dti.pdf', lockedQrProofPolicy()),
    null,
    'naming the private bucket must not satisfy a public-media policy',
  );
  assert.equal(
    parseClientRef('r2://setnayan-media/vendors/X/verification/dti.pdf', lockedQrProofPolicy()),
    null,
  );
});

test('invite: containment only — the flat prefix cannot prove ownership', () => {
  // Documented limitation, asserted so nobody mistakes it for tenancy:
  // `locked-qr-proof/` carries no vendor segment, so any vendor's object under it
  // satisfies the policy. Tightening needs the UPLOADER to add the segment.
  assert.ok(parseClientRef('r2://setnayan-media/locked-qr-proof/someone-elses.jpg', lockedQrProofPolicy()));
});

test('invite: the WIRING pins both proof and remembrance', () => {
  const src = readFileSync(join(WEB, 'app', 'vendor-dashboard', 'invite', 'actions.ts'), 'utf8');
  assert.match(src, /proofRefRaw && parseClientRef\(proofRefRaw, lockedQrProofPolicy\(\)\)/);
  assert.match(src, /parseClientRef\(remembranceRefRaw, lockedQrProofPolicy\(\)\)/);
  // The stored values must be the pinned ones, never the raw fields.
  assert.equal(/proof_r2_key: proofRefRaw|remembrance_r2_key: remembranceRefRaw/.test(src), false);
});
