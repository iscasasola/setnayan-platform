/**
 * ⭐ POOL-ONLY — the switch the Google verification exemption rests on.
 *
 * The property: when pool-only is ON, **no user outside Setnayan's Google
 * organisation can reach the OAuth consent screen.** That single fact is the
 * difference between an Internal-audience app (no brand verification, no
 * sensitive-scope review, ever) and an External one (the full review pipeline,
 * re-triggered by branding changes, on a SENSITIVE scope).
 *
 * So these tests guard a compliance boundary, not a feature flag:
 *   1. DEFAULT OFF — an unset env behaves exactly as production does today.
 *   2. THE DOOR CLOSES SERVER-SIDE — the route refuses before auth and before any
 *      Google call. A UI-only hide would leave the URL reachable by hand.
 *   3. NO FAKE DOOR — neither couple-facing surface renders a Connect button that
 *      the server would refuse.
 *   4. EXISTING GRANTS SURVIVE — closing the door to NEW consents must not revoke
 *      consents already given (goLivePanood keeps its BYO fallback).
 *   5. SEQUENCING IS WRITTEN DOWN — flipping this before a Setnayan channel is
 *      connected would leave Live Studio with no route to air at all.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { liveStudioPoolOnly, POOL_ONLY_CONNECT_NOTICE } from './live-studio-pool-only';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

const START_ROUTE = 'app/api/oauth/youtube/start/route.ts';
const SETUP_PAGE = 'app/dashboard/[eventId]/studio/panood/setup/page.tsx';
const CONTROLLER = 'app/panood/control/[eventId]/page.tsx';

/* ── 1 · Default OFF ──────────────────────────────────────────────────────── */

test('🔒 DEFAULT OFF — an unset environment is today’s behaviour', (t) => {
  delete process.env.NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY;
  assert.equal(liveStudioPoolOnly(), false);
  // And only the exact string 'true' arms it — never a stray 'false'/'1'/'yes'.
  for (const v of ['false', '1', 'yes', 'TRUE', '']) {
    process.env.NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY = v;
    assert.equal(liveStudioPoolOnly(), false, `"${v}" must not arm a compliance boundary`);
  }
  process.env.NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY = 'true';
  assert.equal(liveStudioPoolOnly(), true);
  t.after(() => {
    delete process.env.NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY;
  });
});

/* ── 2 · The door closes SERVER-side, and first ───────────────────────────── */

test('⭐ the BYO consent door is refused by the ROUTE, ahead of auth and Google', () => {
  const src = repoFile(START_ROUTE);
  assert.match(src, /if \(liveStudioPoolOnly\(\)\) \{/, 'the route does not check pool-only at all');

  const gateAt = src.indexOf('if (liveStudioPoolOnly())');
  const authAt = src.indexOf('supabase.auth.getUser()');
  const configAt = src.indexOf('getYoutubeOAuthConfig()');
  // The CALL SITE, not the import — `buildYoutubeAuthorizeUrl` also appears in the
  // import block at the top of the file, which is above every gate by construction.
  const redirectAt = src.indexOf('buildYoutubeAuthorizeUrl({');

  assert.ok(gateAt > -1 && authAt > -1 && redirectAt > -1);
  assert.ok(gateAt < authAt, 'the refusal must precede the auth check — the door is closed, not access-controlled');
  assert.ok(gateAt < configAt, 'the refusal must precede any OAuth config resolution');
  assert.ok(
    gateAt < redirectAt,
    'a user must never be redirected to Google’s consent screen when pool-only is on — that is the whole exemption',
  );
});

/* ── 3 · No fake door on either couple-facing surface ─────────────────────── */

test('neither setup surface offers a Connect button the server would refuse', () => {
  for (const surface of [SETUP_PAGE, CONTROLLER]) {
    const src = repoFile(surface);
    assert.match(
      src,
      /liveStudioPoolOnly\(\)/,
      `${surface} still renders the Connect CTA unconditionally — a fake door`,
    );
    // The notice must come from the shared constant, so the copy cannot drift
    // between the two surfaces or from what the route returns.
    assert.match(src, /POOL_ONLY_CONNECT_NOTICE/, `${surface} hardcodes its own wording`);
  }
});

test('the refusal notice is not an error, and asks nothing of the couple', () => {
  // Nothing has gone wrong and there is no retry — Setnayan supplies the channel.
  assert.doesNotMatch(POOL_ONLY_CONNECT_NOTICE, /error|failed|sorry|try again/i);
  assert.doesNotMatch(
    POOL_ONLY_CONNECT_NOTICE,
    /contact (us|support|setnayan)/i,
    'there is no support action either — the capability is on our side',
  );
  assert.match(POOL_ONLY_CONNECT_NOTICE, /nothing for you to connect/i);
});

/* ── 4 · Existing consents are not revoked ───────────────────────────────── */

test('🔒 closing the door to NEW consents does not strand an EXISTING grant', () => {
  // goLivePanood must keep its BYO fallback: a couple who connected before the flip
  // keeps broadcasting. Same grandfathering shape as the Cast SKU retirement (#3716
  // hid the buy CTA and honoured the order).
  const actions = repoFile('app/dashboard/[eventId]/studio/panood/setup/actions.ts');
  assert.match(
    actions,
    /getEventYoutubeAccessToken\(eventId\)/,
    'the BYO fallback was removed — that revokes consent already given, rather than closing the door to new consent',
  );
  assert.doesNotMatch(
    actions,
    /liveStudioPoolOnly/,
    'go-live must not consult pool-only: the flag governs NEW connections, not existing ones',
  );
});

/* ── 5 · The sequencing trap is documented where it will be read ──────────── */

test('the module states the ordering that stops it closing the only working door', () => {
  const src = repoFile('lib/live-studio-pool-only.ts');
  // Prod has 0 pool channels today, so flipping this on prematurely would leave
  // Live Studio unable to broadcast at all.
  assert.match(src, /0 pool channels/i, 'the current prod state is not recorded');
  assert.match(src, /no route to air/i, 'the consequence of flipping too early is not stated');
  assert.match(src, /G1/, 'the owner gate that must precede the flip is not named');
});

/* ── 6 · The org_internal window (added with the Internal-audience switch) ──── */

test('⭐ Google’s org_internal is TRANSLATED, never forwarded as a failure', () => {
  // The BYO route and the pool route share ONE OAuth client. The moment Internal
  // credentials are configured, the couple-facing door starts answering
  // `org_internal` — and keeps doing so until NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY is
  // flipped. Those are two human actions in two different systems (Google Cloud,
  // Vercel) with nothing enforcing their order. This closes the window between them.
  const cb = repoFile('app/api/oauth/youtube/callback/route.ts');
  const translateAt = cb.indexOf("if (oauthError === 'org_internal')");
  const forwardAt = cb.indexOf('if (oauthError) {');
  assert.ok(translateAt > -1, 'org_internal is forwarded verbatim — the couple sees a raw error code');
  assert.ok(
    translateAt < forwardAt,
    'the translation must precede the catch-all, or the verbatim branch wins',
  );
  assert.match(cb, /redirectWithError\(url, null, 'pool_only'\)/);
});

test('the couple sees a STATUS, not a failure — and not "contact support"', () => {
  // Nothing failed, retrying cannot help, and support cannot fix it. Rendering this
  // through the generic error branch would tell the couple three untrue things.
  const page = repoFile('app/dashboard/[eventId]/studio/panood/setup/page.tsx');
  assert.match(page, /youtubeError === 'pool_only'/, 'pool_only falls through to the error renderer');
  const poolAt = page.indexOf("youtubeError === 'pool_only'");
  const genericAt = page.indexOf('YouTube connection failed (');
  assert.ok(poolAt < genericAt, 'the pool_only branch must be checked BEFORE the generic error');
  // Same shared constant as the closed door and the controller — one wording.
  assert.match(page, /\{POOL_ONLY_CONNECT_NOTICE\}/);
});
