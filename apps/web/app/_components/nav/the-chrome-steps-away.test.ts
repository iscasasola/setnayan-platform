/**
 * the-chrome-steps-away.test.ts — 🫥 THE CHROME STEPS AWAY; A RE-TAP ON THE ACTIVE TAB SAYS SO (THE ONE BUILD F4, 8 Nov 2026).
 *
 * (a) v66/v71, owner: *"top nav and bottom nav hide"* while a picked client fills the screen — `useChromeAway(on)` writes
 *     ONE attribute on <html>; below 1024 the top bar slides up, the bottom bar down, 0.32 s, the way back the same
 *     curve (the exact reverse); the bar's clearance drops to the safe-area inset so the thumb row settles where the bar
 *     was; unmounting always brings the chrome back.
 * (b) owner: *"pressing it again will go to the unselected client page"* — a tap on the ACTIVE tab dispatches a
 *     cancelable `sn:tab-reselect` with the tab's key; a page that handles it cancels the tab's own navigation, else
 *     the tab navigates as before (and with no script at all, it is a plain link).
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): the cleanup's `removeAttribute(CHROME_AWAY_ATTR)` deleted (red: a);
 * the `active &&` gate dropped from the tab's click (red: b).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { CHROME_AWAY_ATTR, CHROME_AWAY_MS, TAB_RESELECT_EVENT, dispatchTabReselect } from './use-chrome-away';

const WEB = join(__dirname, '..', '..', '..');
const HOOK = stripComments(readFileSync(join(WEB, 'app/_components/nav/use-chrome-away.ts'), 'utf8'));
const NAV = stripComments(readFileSync(join(WEB, 'app/_components/nav/bottom-nav.tsx'), 'utf8'));
const FD = readFileSync(join(WEB, 'app/_components/frontdoor/front-door.css'), 'utf8');

test('(a) the chrome steps away below 1024 — 0.32 s each way — and always comes back', () => {
  assert.equal(CHROME_AWAY_ATTR, 'data-chrome-away');
  assert.equal(CHROME_AWAY_MS, 320);
  assert.match(HOOK, /root\.setAttribute\(CHROME_AWAY_ATTR, ''\);/);
  assert.match(HOOK, /return \(\) => \{\s*root\.removeAttribute\(CHROME_AWAY_ATTR\);/, 'leaving the page could strand the chrome away');
  assert.doesNotMatch(HOOK, /\buseState\b/);
  const block = FD.slice(FD.indexOf('@media (max-width: 1023.98px) {\n  html[data-chrome-away]'));
  assert.ok(block.length > 0, 'the chrome-away rules are not inside the < 1024 query');
  assert.match(block, /html\[data-chrome-away\] \.fd\[data-chrome='app'\] \.fd-topwrap \{\s*transform: translateY\(-100%\);\s*transition: transform 0\.32s/);
  assert.match(block, /html\[data-chrome-away\] \[data-bottom-dock\] \{\s*transform: translateY\(100%\);/);
  assert.match(block, /html\[data-chrome-away\] \{\s*--sn-bottomdock-h: env\(safe-area-inset-bottom, 0px\) !important;/, 'the thumb row would float where the bar was');
  assert.match(block, /html\[data-chrome-back\] \.fd\[data-chrome='app'\] \.fd-topwrap,\s*html\[data-chrome-back\] \[data-bottom-dock\] \{\s*transition: transform 0\.32s cubic-bezier\(0\.2, 0\.8, 0\.2, 1\);/, 'the way back is not the same curve');
  assert.match(block, /prefers-reduced-motion: reduce/);
});

test('(b) a re-tap on the ACTIVE tab tells the page; a handled one skips the tab’s own navigation', () => {
  assert.equal(TAB_RESELECT_EVENT, 'sn:tab-reselect');
  assert.match(NAV, /if \(active && dispatchTabReselect\(\{ key: item\.key, href: item\.href \}\)\) e\.preventDefault\(\);/);
  assert.match(HOOK, /new CustomEvent<TabReselectDetail>\(TAB_RESELECT_EVENT, \{ detail, cancelable: true \}\)/);
  // On the server (no window) nothing is dispatched and nothing is cancelled.
  assert.equal(dispatchTabReselect({ key: 'customers', href: '/vendor-dashboard/customers' }), false);
  // In a page: a listener that cancels → the tab skips its navigation; none → it navigates.
  const g = globalThis as unknown as { window?: EventTarget };
  const had = g.window;
  const target = new EventTarget();
  g.window = target;
  try {
    assert.equal(dispatchTabReselect({ key: 'customers', href: '/x' }), false, 'no listener, yet the navigation was skipped');
    const handler = (e: Event) => e.preventDefault();
    target.addEventListener(TAB_RESELECT_EVENT, handler);
    assert.equal(dispatchTabReselect({ key: 'customers', href: '/x' }), true, 'a handled re-tap still navigated');
    target.removeEventListener(TAB_RESELECT_EVENT, handler);
  } finally {
    g.window = had;
  }
});
