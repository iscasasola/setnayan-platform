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
  // Both flags read from the PURE sibling, not `lib/panood-camera-seats.ts`.
  // They moved there when the service-role chain was cut (2026-08-13): the
  // streaming flag is read by `control-room.tsx` ('use client'), and a value
  // import from the seat module reached `createAdminClient` via
  // `eventSkuActive`. NEXT_PUBLIC_ inlining is the reason this row exists at
  // all, and it is a browser concern — so the pure side is where it belongs.
  [
    'lib/panood-camera-seats-pure.ts',
    ['NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED', 'NEXT_PUBLIC_PANOOD_STREAMING_ENABLED'],
  ],
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
  // ⚠ A PAIR. page.tsx decides whether the "Get a new QR" button is OFFERED;
  // rotate-qr-actions.ts decides whether pressing it WORKS. Converting one and
  // not the other showed the offer and then refused it as 'disabled', which the
  // hub renders as "Something went wrong". The sweep below now enforces this
  // for every registered flag, not just this one.
  ['app/[slug]/page.tsx', ['GUEST_QR_SELF_ROTATE']],
  ['app/[slug]/rotate-qr-actions.ts', ['GUEST_QR_SELF_ROTATE']],
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

// ─────────────────────────────────────────────────────────────────────────────
// THE HALF-PAIR SWEEP (2026-08-09)
//
// The two registries above are hand-written lists, and a hand-written list only
// pins the sites somebody REMEMBERED. `GUEST_QR_SELF_ROTATE` proved the gap:
// `app/[slug]/page.tsx` was converted and listed, while
// `app/[slug]/rotate-qr-actions.ts` — the action that actually rotates the QR —
// kept `=== 'true'` and was in NEITHER registry, so nothing noticed. With the
// flag set to `TRUE`, a guest whose invitation QR had leaked was offered a new
// one, confirmed, and got "Something went wrong".
//
// So this sweep stops trusting the list and asks the REPO instead: for every
// flag either registry names, find EVERY reader of it anywhere under apps/web
// and require them all to agree.
//
//   registered as CONVERTED   ⇒ every reader must go through envFlagEnabled
//   registered as HELD_STRICT ⇒ every reader must stay a literal comparison
//
// Both directions matter. A flag that is lenient in one file and strict in
// another is a split brain whichever way round it is: one half of the product
// believes the feature is on and the other half believes it is off, and neither
// logs anything.
// ─────────────────────────────────────────────────────────────────────────────

/** Directories that are not source. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage', '.git']);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function walkSource(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkSource(abs, out);
      continue;
    }
    if (!entry.isFile() || !SOURCE_EXT.test(entry.name)) continue;
    // Test files legitimately ASSIGN and DELETE these env vars to exercise the
    // parser (`process.env.X = 'TRUE'`), which is not a reader and must not be
    // mistaken for one. Known blind spot, stated rather than hidden: a strict
    // READ inside a test file would not be caught — no test file gates a
    // feature, so nothing a user can reach depends on one.
    if (/\.test\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) continue;
    out.push(abs);
  }
  return out;
}

/**
 * Source with comments removed — a proper block-comment state machine, not a
 * line filter. Every file in this repo explains its flag in a docblock directly
 * above the line that reads it, so a whole-file grep would match the PROSE and
 * pass on its own justification. This is the difference between a guard and a
 * decoration.
 *
 * Returns 1-indexed lines so a failure can name the offending line.
 */
function codeLines(src: string): Array<{ n: number; text: string }> {
  const out: Array<{ n: number; text: string }> = [];
  let inBlock = false;
  src.split('\n').forEach((raw, i) => {
    let line = raw;
    if (inBlock) {
      const close = line.indexOf('*/');
      if (close === -1) {
        out.push({ n: i + 1, text: '' });
        return;
      }
      line = line.slice(close + 2);
      inBlock = false;
    }
    line = line.replace(/\/\*.*?\*\//g, ' ');
    const open = line.indexOf('/*');
    if (open !== -1) {
      line = line.slice(0, open);
      inBlock = true;
    }
    // Trailing `//` comment — but never the `//` in a `https://` URL.
    const lineComment = line.search(/(^|[^:])\/\//);
    if (lineComment !== -1) line = line.slice(0, line.indexOf('//', lineComment));
    out.push({ n: i + 1, text: line });
  });
  return out;
}

/**
 * `process.env.FLAG` NOT followed by another identifier character — so
 * `NEXT_PUBLIC_SUITE` cannot match `NEXT_PUBLIC_SUITE_BETA`. A prefix match is
 * how a guard ends up quietly reporting on the wrong symbol.
 */
function readsOf(text: string, flag: string): number {
  return text.match(new RegExp(`process\\.env\\.${flag}(?![A-Za-z0-9_])`, 'g'))?.length ?? 0;
}

const CONVERTED_FLAGS = [...new Set(CONVERTED.flatMap(([, envs]) => envs))].sort();
const HELD_STRICT_FLAGS = [...new Set(HELD_STRICT.map(([, env]) => env))].sort();

type Reader = { rel: string; n: number; text: string };

function collectReaders(flags: readonly string[]): Map<string, Reader[]> {
  const found = new Map<string, Reader[]>(flags.map((f) => [f, []]));
  for (const abs of walkSource(WEB)) {
    const src = readFileSync(abs, 'utf8');
    // Cheap pre-filter — most files mention none of these.
    if (!flags.some((f) => src.includes(f))) continue;
    const rel = abs.slice(WEB.length + 1);
    for (const { n, text } of codeLines(src)) {
      for (const flag of flags) {
        if (readsOf(text, flag) > 0) found.get(flag)!.push({ rel, n, text: text.trim() });
      }
    }
  }
  return found;
}

test('every reader of a CONVERTED flag goes through the shared parser — no half-pairs', () => {
  const readers = collectReaders(CONVERTED_FLAGS);
  const offenders: string[] = [];
  const unread: string[] = [];

  for (const flag of CONVERTED_FLAGS) {
    const sites = readers.get(flag)!;
    // A flag with zero readers means the sweep matched NOTHING for it — a
    // renamed file or a broken matcher — and a loop over an empty list passes
    // for free. Fail instead: silence here is the failure mode this whole test
    // exists to stop.
    if (sites.length === 0) {
      unread.push(flag);
      continue;
    }
    for (const site of sites) {
      const lenient = (
        site.text.match(new RegExp(`envFlagEnabled\\(process\\.env\\.${flag}(?![A-Za-z0-9_])`, 'g'))
          ?? []
      ).length;
      if (lenient < readsOf(site.text, flag)) {
        offenders.push(`${site.rel}:${site.n} — ${flag} — ${site.text}`);
      }
    }
  }

  assert.deepEqual(
    unread,
    [],
    'these registered flags have no reader under apps/web at all — either the ' +
      'feature was deleted (drop the registry row) or the sweep stopped seeing ' +
      'it, in which case it is guarding nothing:\n' + unread.join('\n'),
  );
  assert.deepEqual(
    offenders,
    [],
    'these read a CONVERTED flag WITHOUT the shared parser, so typing TRUE / 1 / ' +
      'yes / on turns the feature on for the sites that were converted and leaves ' +
      'it off here — one half of the product offering what the other half refuses:\n' +
      offenders.join('\n'),
  );
});

test('every reader of a HELD_STRICT flag stays strict — the hold has no leak either', () => {
  const readers = collectReaders(HELD_STRICT_FLAGS);
  const offenders: string[] = [];
  const unread: string[] = [];

  for (const flag of HELD_STRICT_FLAGS) {
    const sites = readers.get(flag)!;
    if (sites.length === 0) {
      unread.push(flag);
      continue;
    }
    for (const site of sites) {
      const strict = (
        site.text.match(
          new RegExp(`process\\.env\\.${flag}(?![A-Za-z0-9_])\\s*[!=]==\\s*'true'`, 'g'),
        ) ?? []
      ).length;
      if (strict < readsOf(site.text, flag)) {
        offenders.push(`${site.rel}:${site.n} — ${flag} — ${site.text}`);
      }
    }
  }

  assert.deepEqual(unread, [], `held-strict flags with no reader at all:\n${unread.join('\n')}`);
  assert.deepEqual(
    offenders,
    [],
    'these widen a flag that is deliberately held strict. Each HELD_STRICT flag ' +
      'gates a compliance or owner decision (DPO sign-off, CSAM enrolment, the ' +
      'full-res sweep), so widening what counts as ON is that decision being made ' +
      'by a find-and-replace:\n' + offenders.join('\n'),
  );
});

/**
 * SCOPE CONTROL for the two sweeps above — a test of the guard's own machinery.
 *
 * The sweeps are only worth anything if `codeLines` really removes comments and
 * `readsOf` really refuses a prefix. If either quietly stopped working, both
 * sweeps would go green over a repo full of violations and look identical to a
 * clean one. So assert the machinery directly, on a fixture, rather than
 * trusting it.
 */
test('the sweep machinery: comments are removed, prefixes are not matched', () => {
  const fixture = [
    "// process.env.NEXT_PUBLIC_SUITE === 'true'   ← a line comment",
    '/**',
    " * Docblock: this used to read process.env.NEXT_PUBLIC_SUITE === 'true'.",
    ' */',
    "const real = process.env.NEXT_PUBLIC_SUITE === 'true';",
    "const trailing = 1; // process.env.NEXT_PUBLIC_SUITE === 'true'",
    "const longer = process.env.NEXT_PUBLIC_SUITE_BETA === 'true';",
    "const url = 'https://example.test/a'; // not a comment before the ://",
    "/* inline */ const inline = process.env.NEXT_PUBLIC_SUITE === 'true';",
  ].join('\n');

  const lines = codeLines(fixture);
  assert.equal(lines.length, 9, 'line numbering must survive comment stripping');

  const hits = lines.filter((l) => readsOf(l.text, 'NEXT_PUBLIC_SUITE') > 0).map((l) => l.n);
  // Only the three REAL reads (lines 5 and 9) survive; the comment on line 6
  // does not, the docblock on lines 2-4 does not, and line 7 is a different
  // variable whose name merely starts with the one we asked about.
  assert.deepEqual(hits, [5, 9], 'exactly the executable reads must be seen');

  assert.equal(readsOf("process.env.NEXT_PUBLIC_SUITE_BETA === 'true'", 'NEXT_PUBLIC_SUITE'), 0);
  assert.equal(readsOf("process.env.NEXT_PUBLIC_SUITE === 'true'", 'NEXT_PUBLIC_SUITE'), 1);
  // The URL line must not be truncated at its `//`, or the stripper would be
  // deleting real code and hiding violations behind it.
  assert.ok(lines[7]!.text.includes('https://example.test/a'));
});

test('no flag is registered as BOTH converted and held strict', () => {
  const both = CONVERTED_FLAGS.filter((f) => HELD_STRICT_FLAGS.includes(f));
  assert.deepEqual(both, [], `contradictory registry rows for: ${both.join(', ')}`);
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
