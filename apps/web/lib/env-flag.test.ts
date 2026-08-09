/**
 * The shared env-flag parser, and the inventory of what has NOT adopted it.
 *
 * On 2026-08-01 the owner set `NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED`, redeployed,
 * and the login wall stayed up. No error, no log line — because a flag that
 * fails to parse looks exactly like a flag that is off. The reader demanded the
 * literal string `true` while ~10 sibling flags in the same repo accepted
 * `true` / `1` / `TRUE`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { envFlagEnabled } from './env-flag';

const HERE = dirname(fileURLToPath(import.meta.url));

test('every reasonable spelling of ON is accepted', () => {
  for (const v of ['true', 'TRUE', 'True', '1', 'yes', 'YES', 'on', 'ON']) {
    assert.equal(envFlagEnabled(v), true, `"${v}" must read as ON`);
  }
});

test('surrounding whitespace is ignored', () => {
  // A trailing space is invisible in a dashboard input and has cost real hours.
  for (const v of [' true', 'true ', '  TRUE  ', '\t1\n']) {
    assert.equal(envFlagEnabled(v), true, `"${JSON.stringify(v)}" must read as ON`);
  }
});

test('FAIL-CLOSED on anything else', () => {
  // These flags gate unfinished and compliance-sensitive features, so an
  // unrecognised value must never be read as permission.
  for (const v of ['false', 'FALSE', '0', 'no', 'off', '', '   ', 'ture', 'enabled', 'y']) {
    assert.equal(envFlagEnabled(v), false, `"${v}" must read as OFF`);
  }
  assert.equal(envFlagEnabled(undefined), false, 'unset must read as OFF');
  assert.equal(envFlagEnabled(null), false, 'null must read as OFF');
});

test('the Papic login-free flag reads through the shared parser', () => {
  const src = readFileSync(join(HERE, 'papic-seats.ts'), 'utf8');
  assert.match(
    src,
    /envFlagEnabled\(process\.env\.NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED\)/,
    'papicSeatAnonEnabled must use envFlagEnabled — and must pass the VALUE, ' +
      'not the name, or NEXT_PUBLIC inlining breaks in the browser.',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// THE NO-REGRESSION REGISTRY (adoption pass, 2026-08-09)
//
// Every site below was converted from strict `process.env.X === 'true'` to the
// shared reader, ONE AT A TIME. The registry is what stops the conversion from
// quietly rotting back: a site that returns to a bare string comparison turns
// its own line red, and the failure names the flag.
//
// ⚠ SCOPED TO CODE, NOT TO THE FILE. Every check below runs on the source with
// comments stripped. A whole-file grep would happily match the docblock that
// explains the bug and pass forever on its own justification.
// ─────────────────────────────────────────────────────────────────────────────

const WEB = resolve(HERE, '..');

/** Drop `//` lines, `/* … *\/` blocks and docblock continuations. */
function codeOnly(src: string): string {
  return src
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function readCode(rel: string): string {
  return codeOnly(readFileSync(join(WEB, rel), 'utf8'));
}

/** file (relative to apps/web) → the env vars it must read through the parser. */
const CONVERTED: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['lib/anon-onboarding.ts', ['NEXT_PUBLIC_ANON_ONBOARDING_ENABLED']],
  ['lib/booth-studio-flag.ts', ['NEXT_PUBLIC_BOOTH_STUDIO_ENABLED']],
  ['lib/chibi-config.ts', ['NEXT_PUBLIC_FIGURE_CHIBI']],
  ['lib/customer-menu.ts', ['NEXT_PUBLIC_SUITE']],
  ['lib/demo-booth-rotation.ts', ['NEXT_PUBLIC_PLAN3D_DEMO_ADS']],
  ['lib/experience-quiz.ts', ['NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED']],
  ['lib/ghost-booths.ts', ['NEXT_PUBLIC_PLAN3D_BOOTH_ADS']],
  ['lib/guest-session.ts', ['GUEST_SESSION_TOKEN_CHECK']],
  ['lib/inquiry-gate.ts', ['NEXT_PUBLIC_INQUIRY_GATE_ENABLED', 'NEXT_PUBLIC_LEAD_TRUST_BADGE_ENABLED']],
  ['lib/integration-config.ts', ['SETNAYAN_AI_PAYWALL_ENABLED']],
  ['lib/invitation-widgets.ts', ['WEBSITE_PHASES_ENABLED']],
  ['lib/live-studio-pool-only.ts', ['NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY']],
  ['lib/live-studio-roam.ts', ['NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED']],
  ['lib/nav-registry-defaults.ts', ['NEXT_PUBLIC_SUITE']],
  ['lib/onboarding-v2-brief-flag.ts', ['NEXT_PUBLIC_ONBOARDING_V2_BRIEF_ENABLED']],
  ['lib/package-authoring-flag.ts', ['NEXT_PUBLIC_PACKAGE_AUTHORING']],
  ['lib/package-credit-flag.ts', ['NEXT_PUBLIC_PACKAGE_CREDIT']],
  ['lib/panood-camera-seats.ts', ['NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED', 'NEXT_PUBLIC_PANOOD_STREAMING_ENABLED']],
  ['lib/papic-seats.ts', ['NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED']],
  ['lib/plausibility-scanner-flag.ts', ['NEXT_PUBLIC_PLAUSIBILITY_SCANNER_ENABLED']],
  ['lib/promo-free-windows.ts', ['PROMO_FREE_WINDOWS_ENABLED']],
  ['lib/public-api-flag.ts', ['PUBLIC_API_ENABLED']],
  ['lib/public-event-url.ts', ['NEXT_PUBLIC_U_NESTING_CUTOVER']],
  ['lib/register-gates.ts', ['NEXT_PUBLIC_REGISTER_GATES_ENABLED']],
  ['lib/setnayan-ai.ts', ['SETNAYAN_AI_PAYWALL_ENABLED']],
  ['lib/vendor-favorite-gate.ts', ['VENDOR_FAVORITES_SUBSCRIPTION_GATE']],
  ['lib/vendor-feature-gate.ts', ['VENDOR_TIER_FEATURE_GATE']],
  ['lib/vendor-search-gate.ts', ['VENDOR_TIER_SEARCH_GATE']],
  ['lib/vendor-seo-tier-flag.ts', ['NEXT_PUBLIC_VENDOR_SEO_TIER_GATE']],
  ['lib/verified-median-flag.ts', ['NEXT_PUBLIC_VERIFIED_MEDIAN_ENABLED']],
  ['app/[slug]/page.tsx', ['GUEST_QR_SELF_ROTATE']],
  [
    'app/_components/desktop-oauth-buttons.tsx',
    ['NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED', 'NEXT_PUBLIC_OAUTH_APPLE_ENABLED', 'NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED'],
  ],
  [
    'app/_components/oauth-button-row.tsx',
    ['NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED', 'NEXT_PUBLIC_OAUTH_APPLE_ENABLED', 'NEXT_PUBLIC_OAUTH_FACEBOOK_ENABLED'],
  ],
  ['app/_components/plan3d/use-plan3d-room.ts', ['NEXT_PUBLIC_PLAN3D_SHARED_ROOM']],
  ['app/admin/_components/admin-nav-groups.tsx', ['NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED']],
  ['app/admin/integrations/page.tsx', ['SETNAYAN_AI_PAYWALL_ENABLED']],
  ['app/admin/offline/_components/offline-diagnostic.tsx', ['NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED']],
  ['app/dashboard/[eventId]/_components/customer-nav-config.ts', ['NEXT_PUBLIC_SUITE']],
  ['app/dashboard/[eventId]/studio/page.tsx', ['NEXT_PUBLIC_SUITE']],
  ['app/dashboard/[eventId]/suite/page.tsx', ['NEXT_PUBLIC_SUITE']],
  ['app/layout.tsx', ['NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED']],
  ['app/papic/seat/[token]/page.tsx', ['NEXT_PUBLIC_CAMERA_BRIDGE_ENABLED']],
  ['app/v/[slug]/booth/page.tsx', ['NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE']],
  ['app/v/[slug]/page.tsx', ['NEXT_PUBLIC_PLAN3D_BOOTH_SHOWCASE']],
];

test('every converted switch still reads through the shared parser', () => {
  for (const [rel, envs] of CONVERTED) {
    const code = readCode(rel);
    for (const env of envs) {
      assert.ok(
        code.includes(`envFlagEnabled(process.env.${env})`),
        `${rel} must read ${env} through envFlagEnabled — and must pass the VALUE, ` +
          'not the name, or NEXT_PUBLIC inlining breaks in the browser.',
      );
    }
  }
});

test('no converted switch regressed to a bare string comparison', () => {
  for (const [rel, envs] of CONVERTED) {
    const code = readCode(rel);
    for (const env of envs) {
      assert.ok(
        !code.includes(`process.env.${env} ===`),
        `${rel} compares ${env} against a literal again — typing TRUE or 1 would ` +
          'silently leave this feature off, which is the whole bug this closed.',
      );
    }
  }
});

/**
 * ⚠ THE DELIBERATE HOLDOUTS.
 *
 * These five readers stay strict ON PURPOSE. Each gates something whose "on"
 * is a compliance or owner decision, so widening what counts as ON is not a
 * parsing bugfix. This test pins BOTH halves — the strict read AND the note
 * that explains it — so nobody can widen one in a later sweep without first
 * deleting the sentence that says not to.
 */
const HELD_STRICT: ReadonlyArray<readonly [string, string]> = [
  ['lib/known-hash-match-flag.ts', 'CSAM_HASH_MATCH_ENABLED'],
  ['lib/account-face-profile.ts', 'NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED'],
  ['lib/device-capture-flag.ts', 'NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED'],
  ['lib/papic-fullres-drop.ts', 'PAPIC_CLIP_DROP_ENABLED'],
  ['lib/daily-email-jobs.ts', 'PAPIC_CLIP_DROP_ENABLED'],
];

test('the deliberate holdouts stay strict, and still say why', () => {
  for (const [rel, env] of HELD_STRICT) {
    const raw = readFileSync(join(WEB, rel), 'utf8');
    assert.ok(
      codeOnly(raw).includes(`process.env.${env} === 'true'`),
      `${rel} must keep reading ${env} strictly — opening it wider is an owner/DPO call.`,
    );
    assert.match(
      raw,
      /DELIBERATELY NOT converted/,
      `${rel} must keep the one-line note saying why ${env} was left strict.`,
    );
  }
});

/**
 * ⚠ INVENTORY, NOT AN ASSERTION — deliberately does not fail.
 *
 * Prints how many `NEXT_PUBLIC_*` readers in lib/ are still strict, so the
 * number stays visible instead of forgotten. It is not an upper bound to
 * defend: a NEW flag-dark feature is entitled to ship strict and be converted
 * later by someone who checked its live value first.
 */
test('inventory: strict flag readers still outstanding', () => {
  const files = readdirSync(HERE).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const strict: string[] = [];
  for (const f of files) {
    const src = codeOnly(readFileSync(join(HERE, f), 'utf8'));
    for (const m of src.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+) === 'true'/g)) {
      strict.push(`${f}:${m[1]}`);
    }
  }
  console.log(`[env-flag] strict NEXT_PUBLIC readers remaining in lib/: ${strict.length}`);
  assert.ok(Array.isArray(strict), 'inventory computed');
});
