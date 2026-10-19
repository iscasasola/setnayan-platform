/**
 * the-app-login-has-no-dead-close.test.ts — the sign-in card's ✕ never points
 * at a door the app bounces straight back to /login.
 *
 * ── WHAT SHIPPED (Apple check 2026-10-19, row #3 — guideline 2.1) ────────────
 * The phone and desktop apps open ON /login. Its ✕ (and Escape, and the
 * backdrop) went to "/", and middleware's brochure bounce
 * (`APP_EXCLUDED_MARKETING_PATHS`) sends "/" back to /login inside the app —
 * so the first button on the first screen App Review sees did nothing.
 *
 * ── WHAT THIS GUARDS — A PROPERTY ───────────────────────────────────────────
 *   1. Wherever the /login page's web dismiss target is a path the app bounces
 *      (read from middleware.ts, not retyped), the page passes `null` in the
 *      app — so the ✕ cannot be dead there by construction.
 *   2. "In the app" is asked with the same two signals middleware's bounce
 *      reads (the `SetnayanApp` user agent, the capacitor cookie).
 *   3. `null` draws no ✕ and makes Escape and the backdrop do nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('the /login ✕ is not drawn in the app when its target is a door the app bounces back', () => {
  const mw = src('middleware.ts');
  const m = mw.match(/APP_EXCLUDED_MARKETING_PATHS = new Set\(\[([^\]]*)\]/);
  assert.ok(m, 'APP_EXCLUDED_MARKETING_PATHS moved out of middleware.ts');
  const bounced = new Set([...m![1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!));

  const page = stripComments(src('app/login/page.tsx'));
  const props = page.match(/dismissHref=\{([^}]*)\}|dismissHref="([^"]*)"/);
  assert.ok(props, '/login no longer passes dismissHref — re-point this guard');
  const expr = props![1] ?? `'${props![2]}'`;
  const targets = [...expr.matchAll(/'([^']*)'/g)].map((x) => x[1]!);
  assert.ok(targets.length > 0, `cannot read a target from dismissHref={${expr}}`);
  const intoBounce = targets.filter((t) => bounced.has(t));
  if (intoBounce.length > 0) {
    // The target is a bounced door — so the app branch must be `null`.
    assert.match(expr, /^\s*inApp\s*\?\s*null\s*:/, `dismissHref={${expr}} points at ${intoBounce.join(', ')}, which the app sends back to /login — pass null in the app`);
    assert.match(page, /const inApp = \(await getRequestPlatform\(\)\) !== 'web';/, '"in the app" must be the request-platform question');
  }

  // middleware's bounce and getRequestPlatform read the same two signals.
  assert.match(mw, /function isCapacitorClient[\s\S]{0,200}setnayan-client-type'\)\?\.value === 'capacitor'[\s\S]{0,120}includes\('SetnayanApp'\)/);
  const rp = src('lib/request-platform.ts');
  assert.match(rp, /const isNative = \/SetnayanApp\/i\.test\(ua\) \|\| clientType === 'capacitor';\s*if \(!isNative\) return 'web';/);
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
