/**
 * Guard: "no" has to mean no — on both paths, and after the fact.
 *
 * WHAT WAS WRONG, measured on `origin/main` a8f8601. The analytics opt-out
 * already existed and was already durable and per-device (`lib/cookie-consent.ts`
 * + the site-wide banner). It was honoured on the way IN and ignored on the way
 * OUT, twice over:
 *
 *   1. THE BROWSER. `PostHogProvider` gated INITIALIZATION on consent, but every
 *      capture site then asked `isLoaded(client)` — which stays true forever once
 *      analytics were ever accepted. Somebody who accepted, then opened Cookie
 *      settings and switched analytics off, kept an initialized SDK capturing
 *      `$pageview` on every navigation, plus autocapture and `capture_pageleave`,
 *      for the rest of the session. Nothing ever called `opt_out_capturing()`.
 *      And `identify()` was keyed on the user id alone, so declining and then
 *      signing in attached their user id to the session they had just refused.
 *   2. THE SERVER. `lib/analytics.ts` captured events keyed to the Supabase
 *      user_id from **15** call sites — signup, login, onboarding, event
 *      creation, payments — with no consent check at all. A choice honoured on
 *      one of two paths is not honoured.
 *
 * And a third, smaller one: the control could not be REACHED from inside the
 * product. "Cookie settings" lives in the marketing and legal footers, and the
 * dashboard, admin and vendor trees mount no footer — measured, zero occurrences
 * in all three.
 *
 * THE CAPTURE-SITE LIST IS DERIVED FROM THE CODE, not hand-written: every
 * `client.capture(` / `client.identify(` in the provider is found and its
 * enclosing effect is required to mention the choice. A hand-listed set here
 * would be a list of the sites I happened to think of — which is precisely how
 * the page tracker was missed in the first place.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

const read = (...p: string[]) => readFileSync(join(WEB, ...p), 'utf8');

/** Comments here name the old behaviour; a raw grep would match the story. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const PROVIDER = strip(read('app', '_components', 'posthog-provider.tsx'));

test('🔴 every browser capture site asks the CHOICE, not just whether the SDK is loaded', () => {
  /* Split on effect boundaries and find the blocks that actually send something. */
  const blocks = PROVIDER.split(/useEffect\(/);
  const sending = blocks.filter((b) => /client\.(capture|identify)\(/.test(b));

  assert.ok(
    sending.length >= 2,
    `floor: expected 2+ effects that send to PostHog, found ${sending.length}. ` +
      'If they were restructured, re-derive — do not lower this to go green.',
  );

  for (const b of sending) {
    assert.match(
      b,
      /analyticsAllowed\(\)|consentReady/,
      'a PostHog capture/identify effect is guarded only by `isLoaded` — that is ' +
        'true forever once analytics were ever accepted, so it keeps firing after ' +
        'somebody switches them off.',
    );
  }
});

test('🔴 withdrawing consent actually stops the SDK, and re-granting starts it again', () => {
  assert.match(
    PROVIDER,
    /client\.opt_out_capturing\(\)/,
    'nothing calls the SDK kill switch — autocapture and pageleave fire from ' +
      'inside PostHog and are not reachable by gating our own capture calls',
  );
  assert.match(
    PROVIDER,
    /client\.reset\(\)/,
    'opting out must also drop the distinct_id, or what was already collected ' +
      'stays tied to the person who just said no',
  );
  assert.match(
    PROVIDER,
    /client\.opt_in_capturing\(\)/,
    'a person who opts out and changes their mind again must be able to — ' +
      'without opt_in, the SDK stays muted for good once it has been opted out',
  );
});

test('🔴 the SERVER half honours it too, at one gate', () => {
  const analytics = strip(read('lib', 'analytics.ts'));
  assert.match(
    analytics,
    /if \(!\(await analyticsConsented\(\)\)\) return;/,
    'lib/analytics.ts sends server-side events keyed to the Supabase user_id; ' +
      'without this gate a person who declined is still measured by name',
  );
  assert.match(
    analytics,
    /CONSENT_STORAGE_KEY/,
    'the server gate must read the SAME cookie the banner writes — a second key ' +
      'is a second answer to one question',
  );
  /* Fails CLOSED. Every early return in the consent reader must be `false`. */
  const fn = analytics.slice(analytics.indexOf('async function analyticsConsented'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(
    !/return true;/.test(body.replace(/parsed\.analytics === true/g, '')),
    'the server consent reader must fail closed — the only `true` it may return ' +
      'is a cookie that explicitly says analytics are allowed',
  );
});

test('🔴 the call sites did NOT each grow their own check', () => {
  /* One gate was the point. If consent starts being asked at call sites, the
     next call site will forget — which is the defect this replaced. */
  const files: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts') || p.endsWith('.tsx')) files.push(p);
    }
  })(join(WEB, 'app'));

  const callers = files.filter(
    (f) => !f.includes('.test.') && /\bcaptureEvent\(\{/.test(readFileSync(f, 'utf8')),
  );
  assert.ok(
    callers.length >= 8,
    `floor: expected 8+ server capture call sites, found ${callers.length}`,
  );
  const diy = callers.filter((f) => /analyticsConsented|CONSENT_STORAGE_KEY/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(
    diy.map((f) => f.slice(WEB.length + 1)),
    [],
    'a call site is checking consent for itself — the gate belongs in ' +
      'lib/analytics.ts alone, so the next call site cannot forget it',
  );
});

test('🚪 a signed-in person can reach the control from their profile', () => {
  const profile = strip(read('app', 'dashboard', '(account)', 'profile', 'page.tsx'));
  assert.match(
    profile,
    /<AnalyticsChoice \/>/,
    'the profile no longer offers the analytics choice — the dashboard tree ' +
      'mounts no footer, so this is the only way in from inside the product',
  );

  const control = strip(
    read('app', 'dashboard', '(account)', 'profile', '_components', 'analytics-choice.tsx'),
  );
  assert.match(
    control,
    /openConsentManager\(\)/,
    'the profile row must open the one existing panel',
  );
  /* ⛔ IT MUST NOT BECOME A SECOND STORE. Two answers to one question drift. */
  for (const forbidden of [/writeConsent\(/, /localStorage\.setItem/, /fetch\(/]) {
    assert.ok(
      !forbidden.test(control),
      `the profile row is persisting its own copy of the choice (${forbidden}) — ` +
        'it must report and open the single existing one, never store a rival',
    );
  }
});

test('🚪 …and the panel it opens is still mounted on every route', () => {
  /* `openConsentManager()` dispatches an event. If nothing is listening the
     button is a control with no handle — the exact shape this repo has found
     five times. */
  const layout = strip(read('app', 'layout.tsx'));
  assert.match(
    layout,
    /<CookieConsentBanner \/>/,
    'the consent panel is not mounted in the root layout, so every "Cookie ' +
      'settings" button in the product now does nothing at all',
  );
});
