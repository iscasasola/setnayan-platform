/**
 * apps/web/lib/view-as-free.test.ts
 *
 * 👁 THE "VIEW AS A FREE COUPLE" RULE — pure, so it is tested by calling it.
 * (The request half, `view-as-free.server.ts`, imports `server-only` and is held
 * by the source guard in `view-as-free-never-changes-a-save.test.ts`.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEW_AS_FREE_COOKIE,
  proAsViewed,
  viewAsFreeCookieOn,
  viewAsFreeCookieString,
  viewAsFreeHonoured,
} from './view-as-free';

test('the switch takes Pro away while it is on, and only then', () => {
  assert.equal(proAsViewed(true, true), false, 'a Pro event viewed as free must read as not Pro');
  assert.equal(proAsViewed(true, false), true, 'switch off: the real answer, untouched');
});

test('the switch can NEVER grant Pro', () => {
  assert.equal(proAsViewed(false, true), false);
  assert.equal(proAsViewed(false, false), false);
});

test('only an internal viewer is honoured — a stray cookie on anyone else does nothing', () => {
  assert.equal(viewAsFreeHonoured({ cookie: '1', isInternal: true }), true);
  assert.equal(
    viewAsFreeHonoured({ cookie: '1', isInternal: false }),
    false,
    'a real couple on a shared browser must never be shown their paid page as free',
  );
  assert.equal(viewAsFreeHonoured({ cookie: null, isInternal: true }), false);
  assert.equal(viewAsFreeHonoured({ cookie: '0', isInternal: true }), false);
});

test('only the exact value "1" is on', () => {
  for (const v of [undefined, null, '', '0', 'true', 'on', ' 1']) {
    assert.equal(viewAsFreeCookieOn(v), false, `"${String(v)}" must read as off`);
  }
  assert.equal(viewAsFreeCookieOn('1'), true);
});

test('the cookie the switch writes is the cookie the server reads', () => {
  const on = viewAsFreeCookieString(true, true);
  assert.match(on, new RegExp(`^${VIEW_AS_FREE_COOKIE}=1;`));
  assert.match(on, /Path=\//, 'every surface (the canvas, /api/hub-print, the QR) must receive it');
  // ⏱ A SESSION cookie (owner 2026-09-28: it "must switch itself off when the
  // owner leaves the Maker (not persist 24 h)") — never a lifetime of its own;
  // the Maker clears it when left (`ViewAsFreeKeeper`).
  assert.doesNotMatch(on, /Max-Age|Expires/i, 'the switch outlives the Maker');
  assert.match(on, /Secure/);
  const off = viewAsFreeCookieString(false, false);
  assert.match(off, new RegExp(`^${VIEW_AS_FREE_COOKIE}=;`));
  assert.match(off, /Max-Age=0/, 'turning it off must clear it, not store an "off" value');
  assert.doesNotMatch(off, /Secure/);
});
