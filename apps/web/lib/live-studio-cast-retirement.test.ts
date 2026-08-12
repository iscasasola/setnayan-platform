/**
 * ⭐ THE CAST CARD IS RETIRED — and the revoke control it was hiding is not.
 *
 * Two "live streaming" tiles reached the couple's Studio at once:
 *
 *   • "Live Studio"      → /studio/live-studio-control   · serviceKey LIVE_STUDIO
 *                          ₱2,999, is_active = TRUE, listed on the public /pricing page.
 *   • "Live Studio Cast" → /studio/panood                · serviceKey PANOOD_SYSTEM
 *                          ₱2,500, is_active = FALSE in production since 2026-07-26,
 *                          zero orders EVER (checked against prod, 2026-08-06).
 *
 * The second one was a full App Store detail page for a product nobody can buy:
 * checkout refuses a retired SKU, so its own guard already hid the buy button, and
 * what remained was a second Live Studio page whose primary CTA dropped the couple
 * into the legacy Cast setup tree.
 *
 * ── WHY THIS FILE EXISTS RATHER THAN A COMMENT ──────────────────────────────
 *
 * 1. RETIRING THE PAGE ALMOST TOOK A CONTROL WITH IT. The ONLY place in the whole
 *    product where a host could DISCONNECT their Google/YouTube account was a form
 *    on the legacy Cast setup screen. The unified controller
 *    (/panood/control/[eventId]) renders "Connected — <channel>" and offers no way
 *    out; /admin/live-studio-channels disconnects SETNAYAN's pool channels, not the
 *    couple's. /privacy tells the public that control exists. So the replacement is
 *    wired FIRST, onto the page that survives, and test 3 below is what keeps it
 *    there.
 *
 * 2. THE PORT GUARD CANNOT SEE IT. scripts/port-control-baseline.json records the
 *    legacy setup route's destinations as [start, /studio/panood, /privacy] — the
 *    extractor reads `href=`, and Disconnect is a `<form action=…>`. A control that
 *    no automated guard can see is exactly the one to pin down by hand.
 *
 * 3. A PAYING CUSTOMER WAS TOLD THEY HAD NOT PAID. resolvePanoodTier() resolves
 *    only PANOOD_SYSTEM / PANOOD_SYSTEM_MOBILE, and the LIVE_STUDIO → Cast ownership
 *    alias is deliberately ONE-DIRECTIONAL (lib/entitlements.ts). So a couple who
 *    had just paid ₱2,999 read "You have 3 cameras free to test with. Every feed
 *    carries the Setnayan mark until you unlock Live Studio" on the legacy camera
 *    page — the SKU they own is not in the sentence's vocabulary.
 *
 * Source-level assertions on purpose: these are React Server Component pages with
 * no render harness in this repo, and the same shape already guards this exact
 * tree (lib/live-studio-pool-only.test.ts, lib/live-studio-recordings.test.ts,
 * lib/facebook-watch.test.ts).
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const abs = (p: string) => resolve(HERE, '..', p);
const repoFile = (p: string) => readFileSync(abs(p), 'utf8');

const CAST_DETAIL = 'app/dashboard/[eventId]/studio/panood/page.tsx';
const CAST_CAMERAS = 'app/dashboard/[eventId]/studio/panood/cameras/page.tsx';
const CAST_CAMERAS_PRINT = 'app/dashboard/[eventId]/studio/panood/cameras/print/page.tsx';
const LIVE_STUDIO_PAGE = 'app/dashboard/[eventId]/studio/live-studio-control/page.tsx';
const LEGACY_SETUP = 'app/dashboard/[eventId]/studio/panood/setup/page.tsx';
const DISCONNECT_ROUTE = 'app/api/oauth/youtube/disconnect/route.ts';
const DISCONNECT_ENDPOINT = '/api/oauth/youtube/disconnect';

/* ── 0 · NON-VACUITY ──────────────────────────────────────────────────────────
   Every assertion below is a `match` against file text. If a path stops resolving
   the whole file would pass by reading nothing, so prove the files are there and
   are real pages before trusting a single one of them. */

test('NON-VACUITY — every file these assertions rest on exists and has content', () => {
  for (const p of [
    CAST_DETAIL,
    CAST_CAMERAS,
    CAST_CAMERAS_PRINT,
    LIVE_STUDIO_PAGE,
    LEGACY_SETUP,
    DISCONNECT_ROUTE,
  ]) {
    assert.ok(existsSync(abs(p)), `${p} is missing — this suite would pass by reading nothing`);
    assert.ok(repoFile(p).length > 400, `${p} is a stub — assertions against it prove nothing`);
  }
});

/* ── 1 · THE RETIRED CARD NO LONGER SELLS ─────────────────────────────────── */

test('⭐ RETIRED — /studio/panood no longer offers a PANOOD_SYSTEM purchase', () => {
  const src = repoFile(CAST_DETAIL);

  // The buy machinery is what made this a second storefront. All of it goes: the
  // plan sheet, the state CTA, the live price read, and the SKU itself.
  assert.doesNotMatch(
    src,
    /PANOOD_SYSTEM/,
    'the retired Cast SKU is still named on a couple-facing page',
  );
  assert.doesNotMatch(
    src,
    /AddOnStateCta|choosePlan|InlineCheckout/,
    'the buy sheet is still mounted on the retired Cast page',
  );
  assert.doesNotMatch(
    src,
    /Upgrade to multicam/,
    'the retired upgrade CTA copy is still on the page',
  );
});

test('⭐ RETIRED — /studio/panood sends the couple to the Live Studio that exists', () => {
  const src = repoFile(CAST_DETAIL);
  assert.match(src, /\bredirect\(/, '/studio/panood does not redirect at all');
  assert.match(
    src,
    /liveStudioDetailPath|live-studio-control/,
    'the redirect does not resolve to the live Live Studio surface',
  );
});

test('the OAuth landing is not swallowed by the retirement', () => {
  // /api/oauth/youtube/{callback,disconnect} both redirect to /studio/panood with
  // ?youtube_connected / ?youtube_disconnected / ?youtube_error. Those routes are
  // owned elsewhere, so the retirement has to FORWARD what they send — otherwise a
  // host who just connected (or revoked) lands on a page with no acknowledgement,
  // which reads as "it didn't work".
  const src = repoFile(CAST_DETAIL);
  assert.match(src, /searchParams/, 'the redirect stub never reads the query string');
  for (const p of ['youtube_connected', 'youtube_disconnected', 'youtube_error']) {
    assert.match(src, new RegExp(p), `${p} is dropped on the way through the redirect`);
  }
});

/* ── 2 · THE FREE-TIER SENTENCE MUST KNOW ABOUT THE SKU THAT REPLACED CAST ── */

test('⭐ a LIVE_STUDIO owner is never told they are on the free tier', () => {
  const src = repoFile(CAST_CAMERAS);

  // resolvePanoodTier() answers only "did they buy Cast?". The page has to ask the
  // second question itself, because the alias in lib/entitlements.ts runs the other
  // way (a Cast buyer owns Live Studio; a Live Studio buyer does NOT own Cast).
  assert.match(
    src,
    /LIVE_STUDIO/,
    'the camera page still decides the tier from the retired Cast SKUs alone',
  );

  // And the claim itself must be gated on the combined answer, not on the raw
  // Cast-only tier. `tier === 'free'` alone is the shape that shipped the lie.
  assert.doesNotMatch(
    src,
    /\{tier === 'free' &&/,
    "the free-tier sentence is still gated on the Cast-only tier",
  );

  // The sentence, when it does show, still has to be true — so keep it bound to the
  // real constant rather than a re-typed "3".
  assert.match(src, /PANOOD_FREE_CAMERA_COUNT/);
});

test('the printed QR sheet cannot disagree with the screen about the cameras', () => {
  // ── WHAT THIS PROTECTS, AND WHY THE CHECK MOVED ─────────────────────────────
  // The outcome guarded here has never changed: what a host hands out at the venue
  // must match what their control room shows.
  //
  // It used to be guarded by a CAP COMPARISON. cameras/ and cameras/print/ each
  // called provisionPanoodCamerasAdmin with their own cap, so if only one of them
  // learned about LIVE_STUDIO a paid host got 8 seats on screen and 3 on the sheet.
  //
  // The sheet no longer mints seats or carries a cap at all. It renders the
  // CHANNELS the controller has bound, through `fetchChannelCameras` — the reader
  // the controller itself uses — so there is no second number left to get wrong.
  // The drift is now impossible by construction rather than caught by comparison,
  // which is the stronger arrangement; this test asserts the construction holds.
  const src = repoFile(CAST_CAMERAS_PRINT);

  assert.match(
    src,
    /fetchChannelCameras/,
    'the print sheet no longer reads cameras through the controller’s own reader — ' +
      'it can drift from the screen again',
  );
  assert.match(
    src,
    /buildCameraCards/,
    'the print sheet no longer derives its cards from the shared builder the ' +
      'controller sizes its Print doorway with',
  );
  // And it must NOT have grown a cap of its own again — a cap here is the exact
  // shape of the original defect.
  assert.doesNotMatch(
    src,
    /panoodCameraCapForTier|provisionPanoodCamerasAdmin/,
    'the print sheet is minting/capping seats again instead of rendering the ' +
      'controller’s channel bindings',
  );
});

/* ── 3 · THE CONTROL THAT MUST NOT DISAPPEAR ──────────────────────────────── */

test('⭐ THE HOST CAN STILL REVOKE THEIR OWN GOOGLE ACCOUNT', () => {
  // The endpoint exists and is a POST route.
  assert.match(repoFile(DISCONNECT_ROUTE), /export async function POST/);

  // And something a couple can actually reach posts to it. The Live Studio detail
  // page is the surface the surviving Studio card opens, so that is where it lives.
  const page = repoFile(LIVE_STUDIO_PAGE);
  assert.match(
    page,
    new RegExp(DISCONNECT_ENDPOINT.replace(/\//g, '\\/')),
    'Live Studio offers no way to disconnect the connected Google account',
  );
  assert.match(
    page,
    /name="event_id"/,
    'the disconnect form posts no event_id — the route 400s without it',
  );
});

test('the revoke control does not depend on the retired page to be reachable', () => {
  // The whole failure this file guards: the ONLY disconnect form used to be on the
  // legacy Cast setup screen. Prove at least one surface OUTSIDE that tree carries
  // it, so retiring the Cast tree later cannot silently take it away again.
  const outside = [LIVE_STUDIO_PAGE].filter((p) =>
    repoFile(p).includes(DISCONNECT_ENDPOINT),
  );
  assert.ok(
    outside.length > 0,
    'every disconnect control still lives inside the legacy Cast tree',
  );
});

test('the new connect door respects pool-only, exactly as the old ones do', () => {
  // Same compliance boundary lib/live-studio-pool-only.test.ts pins on the legacy
  // setup page and the controller: when Setnayan supplies the channel there is
  // nothing for the couple to connect, and /api/oauth/youtube/start answers 409. A
  // Connect button here without that check would be a third fake door.
  const page = repoFile(LIVE_STUDIO_PAGE);
  assert.match(page, /liveStudioPoolOnly\(\)/, 'the new Connect button ignores pool-only');
  assert.match(page, /POOL_ONLY_CONNECT_NOTICE/, 'pool-only renders without the shared wording');
});
