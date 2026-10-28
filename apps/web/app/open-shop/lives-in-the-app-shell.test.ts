/**
 * GUARD — SUPPLIER SIGN-UP LIVES INSIDE THE APP, NOT IN THE OLD WEBSITE CARD.
 *
 * Owner 2026-10-28, on screenshots of the live /open-shop wizard: *"that is an old website"* · *"why is that shell
 * still existing?"*; 2026-10-29, asked whether to rebuild it inside the app or only swap the services checklist in:
 * *"inside the app"* (corpus DECISION_LOG "FIVE OPEN CALLS ANSWERED" (1), "NO PRIMARY SERVICE … OLD-WEBSITE SHELL").
 *
 * The properties (each sabotaged RED once, then restored — see the PR body):
 *   1. THE PAGE IS IN THE APP SHELL: it lives in `app/(shell)/open-shop/`, whose layout mounts the shared
 *      `AppRailShell` (the same shell as `/start`), and NOT at `app/open-shop/page.tsx`, which rendered bare.
 *   2. NO OLD-WEBSITE CHROME: the wizard is not the bordered card floating mid-page, and /open-shop is not one of
 *      the routes that wear the marketing site's glass nav.
 *   3. THE NEXT PRESS IS IN THE THUMB ZONE: Continue / the submit sit in one bar pinned to the bottom on a phone.
 *   4. RESUME WHERE YOU LEFT OFF: every step change parks the typed steps, and a step draft survives a reload.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const WIZARD = 'app/open-shop/_components/open-shop-wizard.tsx';

test('1 · the page lives in the app shell', () => {
  assert.ok(existsSync('app/(shell)/open-shop/page.tsx'), 'the open-shop page is not under app/(shell)/');
  assert.ok(!existsSync('app/open-shop/page.tsx'), 'a bare app/open-shop/page.tsx is back (it renders with no app shell)');
  assert.match(read('app/(shell)/layout.tsx'), /<AppRailShell\b/, 'the (shell) layout no longer mounts the shared app shell');
  assert.match(read('app/(shell)/open-shop/page.tsx'), /<OpenShopWizard\b/, 'the shell page does not draw the wizard');
});

test('2 · no old-website chrome: no floating card, no glass nav', () => {
  const w = read(WIZARD);
  assert.doesNotMatch(w, /max-w-lg rounded-2xl border/, 'the bordered old-website card is back');
  assert.doesNotMatch(w, /min-h-\[70vh\] items-center justify-center/, 'the wizard is centred mid-page like a website card again');
  const navRoutes = read('app/_components/marketing/site-chrome.tsx').match(/const NAV_ROUTES = new Set<string>\(\[([\s\S]*?)\]\)/);
  assert.ok(navRoutes, 'could not find NAV_ROUTES — the scan is looking at nothing');
  assert.doesNotMatch(navRoutes[1]!, /'\/open-shop'/, '/open-shop wears the marketing glass nav');
});

test('3 · Continue and the submit sit in the thumb bar pinned to the bottom', () => {
  const w = read(WIZARD);
  const at = w.indexOf('data-open-shop-thumb=""');
  assert.ok(at > 0, 'the thumb bar is gone');
  const bar = w.slice(at, at + 2600);
  assert.match(bar.slice(0, 400), /sticky bottom-0/, 'the thumb bar is no longer pinned to the bottom on a phone');
  assert.match(bar, /onClick=\{next\}/, 'Continue left the thumb bar');
  assert.match(bar, /<SubmitButton\b/, 'the submit left the thumb bar');
});

test('4 · every step change parks the draft, and a step draft survives a reload', () => {
  const w = read(WIZARD);
  const next = w.slice(w.indexOf('const next = '), w.indexOf('const back = '));
  assert.match(next, /saveDraft\(\{ step: to \}\)/, 'Continue no longer parks the draft');
  assert.match(next, /saveDraft\(\{ step: n \}\)/, 'going back no longer parks the draft');
  assert.match(
    w,
    /if \(raw && \(!restore \|\| d\?\.atSubmit\)\) sessionStorage\.removeItem\(OPEN_SHOP_DRAFT_KEY\)/,
    'the restore throws away a step draft, so a second reload starts over',
  );
});
