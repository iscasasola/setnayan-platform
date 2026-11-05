/**
 * the-app-login-has-no-dead-close.test.ts — the sign-in card's ✕ never points
 * at a door the app bounces straight back to /login.
 *
 * ── WHAT SHIPPED (Apple check 2026-10-19, row #3 — guideline 2.1) ────────────
 * The phone and desktop apps open ON /login. Its ✕ (and Escape, and the
 * backdrop) went to "/", and middleware's brochure bounce sent "/" back to
 * /login inside the app — so the first button on the first screen App Review
 * sees did nothing. The fix then was to draw no ✕ in the app.
 *
 * ── WHAT CHANGED (owner 2026-11-02, "let everything go live") ───────────────
 * DECISION_LOG "EVERY PAGE HELD BACK FROM THE APP FOR APPLE GOES LIVE IN THE
 * APP TOO": the bounce is gone and the apps open "/" (Discover) like the
 * website. So the ✕ is a real way out in the app as well, and the card draws it
 * there too — one target, "/", everywhere.
 *
 * ── WHAT THIS GUARDS — A PROPERTY ───────────────────────────────────────────
 *   1. Middleware refuses no /login ✕ target in the app: it no longer asks
 *      whether a request comes from the native shell at all, and the store
 *      shell's paid-feature gate does not refuse the target either.
 *   2. The ✕ target is read from the page (not retyped) and is a page that
 *      exists — so the ✕ can never again be a press that lands back on /login.
 *   3. `null` (kept for any card with nowhere to go) still draws no ✕ and makes
 *      Escape and the backdrop do nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { isStoreShellWebOnlyPath } from '@/lib/store-shell';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('the /login ✕ goes to a page the app opens — in the app as on the web', () => {
  // 1 · No native-shell bounce in middleware: nothing tells the app apart from a browser to send it back to /login.
  const mw = stripComments(src('middleware.ts'));
  assert.doesNotMatch(
    mw,
    /APP_EXCLUDED_MARKETING_PATHS|isCapacitorClient|SetnayanApp|setnayan-client-type/,
    'middleware asks "is this the app?" again — if it bounces the ✕ target there, the ✕ is dead on the first screen ' +
      'App Review sees: pass dismissHref={inApp ? null : …} on /login (the request-platform question), then update this test',
  );

  // 2 · The ✕ target, read from the page.
  const page = stripComments(src('app/login/page.tsx'));
  const props = page.match(/dismissHref=\{([^}]*)\}|dismissHref="([^"]*)"/);
  assert.ok(props, '/login no longer passes dismissHref — re-point this guard');
  const expr = props![1] ?? `'${props![2]}'`;
  const targets = [...expr.matchAll(/'([^']*)'/g)].map((x) => x[1]!);
  assert.ok(targets.length > 0, `cannot read a target from dismissHref={${expr}}`);
  for (const t of targets) {
    assert.notEqual(t, '/login', 'the ✕ lands back on /login');
    assert.equal(isStoreShellWebOnlyPath(t), false, `the ✕ goes to ${t}, which the iPhone app refuses (store-shell gate)`);
    assert.equal(isStoreShellWebOnlyPath(t, true), false, `the ✕ goes to ${t}, which the iPhone app refuses where Apple sells`);
  }
  assert.ok(targets.includes('/'), `the ✕ no longer goes to Discover ("/"): dismissHref={${expr}}`);
  assert.ok(existsSync(join(WEB, 'app/page.tsx')) || existsSync(join(WEB, 'app/(shell)/page.tsx')), '"/" has no page');
});

test('dismissHref null draws no ✕, and Escape and the backdrop do nothing', () => {
  const modal = stripComments(src('app/login/_components/sign-in-card-modal.tsx'));
  assert.match(modal, /dismissHref\?: string \| null/);
  assert.match(modal, /const dismissible = dismissHref !== null;/);
  assert.match(modal, /const dismiss = \(\) => \{\s*if \(dismissHref === null\) return;/, 'Escape / backdrop would still navigate');
  // Every ✕ in the card sits behind `dismissible`.
  const xs = modal.match(/aria-label="Close"/g) ?? [];
  assert.equal(xs.length, 1, 'one close button expected');
  const at = modal.indexOf('aria-label="Close"');
  assert.match(modal.slice(Math.max(0, at - 160), at), /\{dismissible \? \(\s*<button/, 'the ✕ renders without asking whether there is anywhere to go');
});
