/**
 * essential-cookies-only.test.ts — SETNAYAN RUNS NO ANALYTICS OR TRACKING SDK, AND NOTHING ASKS FOR COOKIE CONSENT.
 *
 * Owner ruling 2026-10-22 (choice "A", DECISION_LOG): the cookie banner ("We use essential cookies to run Setnayan,
 * and optional analytics to improve it… Accept all · Essential only · Manage") went by DROPPING the optional
 * analytics, not by hiding the question. PostHog (browser SDK, provider, five click counters, nine server-side
 * `captureEvent` call sites, the WebRTC relay telemetry), the banner, its Manage sheet, the consent cookie and its
 * `/api/cookie-consent` route, the profile's "Analytics cookies" row and every "Cookie settings" re-open control were
 * removed together. The App Store privacy label already says "no analytics"; this makes the web match it.
 *
 * 🔑 THE PROPERTY, in two halves, each derived from the tree rather than from a list of files:
 *   (1) no module the app ships — app/, lib/, components/, middleware, instrumentation — imports an analytics or
 *       tracking SDK (static, dynamic, side-effect or require), loads a tracker's script host, or depends on one in
 *       package.json. Error reporting (Sentry) is NOT analytics: it sets no cookie and stays.
 *   (2) nothing asks for cookie consent: the root layout mounts no cookie/consent component, no source writes a
 *       consent cookie or opens a consent manager, no route answers `/api/cookie-consent`, and no control names
 *       itself a cookie-consent or cookie-settings control.
 *
 * A tracker that comes back has to come back through one of those doors, and each door is a red here — the only
 * honest way to green it is a new DECISION_LOG row and an edit to this file. Sabotage runs are in the PR body.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

/** Every shipped source file (tests and dev labs included in the walk only where they ship — tests never do). */
function shippedSources(): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const name of readdirSync(join(WEB, rel))) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const child = `${rel}/${name}`;
      if (statSync(join(WEB, child)).isDirectory()) walk(child);
      else if (/\.(?:tsx?|jsx?|mjs|cjs)$/.test(name) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)) out.push(child);
    }
  };
  for (const dir of ['app', 'lib', 'components']) if (existsSync(join(WEB, dir))) walk(dir);
  for (const f of ['middleware.ts', 'instrumentation.ts', 'next.config.ts']) if (existsSync(join(WEB, f))) out.push(f);
  return out;
}

const FILES = shippedSources();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Analytics / tracking / session-recording SDKs. A package is banned if its name matches. */
const TRACKER_PACKAGE =
  /^(?:posthog-js|posthog-node|@posthog\/.+|@vercel\/analytics|@vercel\/speed-insights|react-ga4?|ga-4-react|@next\/third-parties(?:\/.+)?|mixpanel(?:-browser)?|@amplitude\/.+|amplitude-js|@segment\/.+|analytics|@analytics\/.+|react-facebook-pixel|@hotjar\/.+|react-hotjar|@microsoft\/clarity|logrocket(?:-react)?|@fullstory\/.+|heap-api|plausible-tracker|fathom-client|@datadog\/browser-rum(?:-.+)?|@snowplow\/.+|matomo-tracker|@openreplay\/.+)$/;

/** Script / beacon hosts of the same trackers, as they appear in a src, a fetch or a CSP. */
const TRACKER_HOST =
  /\b(?:[a-z0-9-]+\.)*(?:posthog\.com|googletagmanager\.com|google-analytics\.com|connect\.facebook\.net|static\.hotjar\.com|clarity\.ms|cdn\.segment\.com|api\.segment\.io|plausible\.io|usefathom\.com|cdn\.mxpnl\.com|api\.amplitude\.com|cdn\.logrocket\.io|edge\.fullstory\.com|analytics\.tiktok\.com|snap\.licdn\.com)\b/i;

function moduleSpecifiers(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

test('(1a) no shipped module imports an analytics or tracking SDK — static, dynamic, side-effect or require', () => {
  assert.ok(FILES.length > 3000 && FILES.includes('app/layout.tsx') && FILES.includes('app/providers.tsx'), `anti-vacuity: walked ${FILES.length} files`);
  let specifiers = 0;
  const hits: string[] = [];
  for (const f of FILES) {
    for (const spec of moduleSpecifiers(code(f))) {
      specifiers++;
      if (TRACKER_PACKAGE.test(spec)) hits.push(`${f} → ${spec}`);
    }
  }
  assert.ok(specifiers > 20000, `anti-vacuity: only ${specifiers} import specifiers read — the scan went blind`);
  assert.deepEqual(hits, [], 'an analytics/tracking SDK is imported again — Setnayan uses essential cookies only (DECISION_LOG 2026-10-22)');
});

test('(1b) no shipped module loads or calls a tracker host, and package.json depends on no tracker', () => {
  const hits = FILES.filter((f) => TRACKER_HOST.test(code(f))).map((f) => `${f}: ${TRACKER_HOST.exec(code(f))?.[0]}`);
  assert.deepEqual(hits, [], 'a tracker host is back in shipped code (a <script src>, a fetch, or the CSP)');

  const pkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>;
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies });
  assert.ok(deps.includes('next') && deps.includes('@sentry/nextjs'), 'anti-vacuity: package.json was not read');
  assert.deepEqual(deps.filter((d) => TRACKER_PACKAGE.test(d)), [], 'apps/web depends on an analytics/tracking package again');
});

test('(2a) the root layout mounts no cookie or consent component', () => {
  const layout = code('app/layout.tsx');
  const mounted = [...layout.matchAll(/^import\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/gm)].flatMap((m) =>
    (m[1] ?? '').split(',').map((n) => `${n.trim()} (${m[2]})`),
  );
  assert.ok(mounted.length > 10, `anti-vacuity: only ${mounted.length} layout imports read`);
  assert.deepEqual(mounted.filter((n) => /cookie|consent/i.test(n)), [], 'the root layout imports a cookie/consent component again');
  assert.doesNotMatch(layout, /<\w*(?:Cookie|Consent)\w*\b/, 'the root layout renders a cookie/consent component again');
});

test('(2b) nothing writes a consent choice, opens a consent manager, or names itself a cookie-consent control', () => {
  assert.ok(!existsSync(join(WEB, 'app', 'api', 'cookie-consent')), 'a /api/cookie-consent route exists again');
  const hits: string[] = [];
  for (const f of FILES) {
    const src = code(f);
    if (/cookie-consent|openConsentManager|writeConsent|analyticsAllowed|CONSENT_STORAGE_KEY/.test(src)) hits.push(`${f}: consent state`);
    if (/aria-label=["'{`][^"'`}]*cookie (?:consent|settings)/i.test(src)) hits.push(`${f}: a cookie-consent control`);
    if (/data-cookie-consent/.test(src)) hits.push(`${f}: the banner's mark`);
  }
  assert.deepEqual(hits, [], 'a cookie-consent mechanism is back — with essential cookies only there is nothing to ask');
});
