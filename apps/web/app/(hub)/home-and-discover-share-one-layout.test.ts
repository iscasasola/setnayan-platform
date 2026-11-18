/**
 * 🛡 HOME AND DISCOVER SHARE ONE LAYOUT — the bars never remount between them.
 *
 * Owner 18 Nov 2026, verbatim: *"yes, unify home and discover on fable"*; and 17 Nov (DECISION_LOG "navigation bars
 * should not load with the screen"): *"Top bar, tab bar and rail live in the shared layout and never remount or
 * redraw on a tab or page change; only the content area swaps."*
 *
 * WHAT FAILED (live f8f278f, 390 px): signed in, Home (`/dashboard`) sat under `app/dashboard/(launcher)/layout.tsx`
 * and Discover (`/`) under nothing but the root, so the tap between them mounted a NEW `header.fd-topbar`, a NEW Menu
 * button and a new rail — and the two bars even looked different (gold mark + plain avatar vs text-only SETNAYAN).
 *
 * 🔑 WHY A SOURCE GUARD PROVES IT. The App Router keeps a layout's DOM across a navigation exactly when BOTH pages
 * sit below that layout — that is the router's contract, not ours. So "the bar does not remount" is equivalent to
 * four facts about the tree, each asserted here:
 *   1 · both pages are under `app/(hub)/` (and nowhere else serves either URL);
 *   2 · `app/(hub)/layout.tsx` draws the shell, the bar and the one <main> — signed in only;
 *   3 · neither page draws a shell, a bar or a slide element of its own while the layout does;
 *   4 · signed out, `/` is the front door exactly as before (#7840 "signed out sees the front door only").
 * Every one is RED on main (f8f278f), where the layout does not exist and `front-door.tsx` draws its own shell.
 *
 * SABOTAGE (each turns this red): move `page.tsx` back to `app/` · render `<FrontDoorShell>` before the `hubShell`
 * return · add `<FrontDoorAccountBar />` or `className="sn-vt-page"` to `front-door.tsx` · drop the
 * `if (!user) return <>{children}</>;` line from the layout.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const APP = join(import.meta.dirname, '..');
const HUB = join(APP, '(hub)');
const WEB = join(APP, '..');
const code = (abs: string) => stripComments(readFileSync(abs, 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('1 · `/` and `/dashboard` are both pages of the (hub) group — and no other file serves either URL', () => {
  assert.ok(existsSync(join(HUB, 'page.tsx')), '`/` is not under (hub) — Home ↔ Discover remounts the bars again');
  assert.ok(existsSync(join(HUB, 'dashboard', 'page.tsx')), '`/dashboard` is not under (hub)');
  assert.ok(existsSync(join(HUB, 'layout.tsx')), 'the shared layout is gone');
  // A second page for the same URL is a build error at best and a split tree at worst.
  assert.ok(!existsSync(join(APP, 'page.tsx')), 'app/page.tsx is back — `/` left the shared layout');
  assert.ok(!existsSync(join(APP, 'dashboard', '(launcher)', 'page.tsx')), 'the launcher page is back outside (hub)');
  assert.ok(!existsSync(join(APP, 'dashboard', '(launcher)', 'layout.tsx')), 'a second launcher layout draws a second bar');
  // No other route group at the root may serve `/` either.
  for (const d of readdirSync(APP)) {
    if (!/^\(.+\)$/.test(d) || d === '(hub)' || !statSync(join(APP, d)).isDirectory()) continue;
    assert.ok(!existsSync(join(APP, d, 'page.tsx')), `app/${d}/page.tsx also serves \`/\``);
  }
});

test('2 · the (hub) layout draws the shell, the account bar and the ONE <main> — for a signed-in person only', () => {
  const hub = code(join(HUB, 'layout.tsx'));
  // Signed out: nothing of ours, before any read.
  assert.match(hub, /const user = await hubDrawsTheShell\(\);\s*if \(!user\) return <>\{children\}<\/>;/);
  assert.equal(count(hub, /<AppRailShell\b/g), 1, 'the shell is drawn once');
  // The drawing's ONE look for both pages: the app variant (gold mark + "Setnayan", bell, plain avatar).
  assert.doesNotMatch(hub, /variant=/, 'the hub shell is the app variant (the default) — the drawing shows one bar');
  assert.match(hub, /boundary="tab"/);
  assert.match(hub, /topBarSlot=\{[\s\S]*?<UnreadBellBadge[\s\S]*?<AccountSwitcher data=\{switcherData\} \/>/);
  assert.equal(count(hub, /<main\b/g), 1, 'one <main> for both pages');
  assert.equal(count(hub, /\bsn-vt-page\b/g), 1, 'one slide element for both pages');
  assert.equal(count(hub, /<AccountBarSlot\b/g), 1, 'one account bar for both pages');
  // The add flow's slot is Home's own, below the gate — never this layout's.
  assert.doesNotMatch(hub, /\bmodal\b/);
});

test('3 · Discover draws no shell, bar or slide of its own while the layout draws them', () => {
  const fd = code(join(APP, '_components', 'frontdoor', 'front-door.tsx'));
  assert.match(fd, /const hubShell = \(await hubDrawsTheShell\(\)\) !== null;/);
  const ret = fd.indexOf('if (hubShell) {');
  const shell = fd.indexOf('<FrontDoorShell');
  assert.ok(ret > 0 && shell > ret, 'Discover draws its own shell before (or instead of) handing it to the layout');
  const hubBranch = fd.slice(ret, shell);
  assert.match(hubBranch, /return \(\s*<>\s*<h1 className="fd-sr-only">/, 'the app variant leaves the page its <h1>');
  assert.equal(count(fd, /<FrontDoorShell\b/g), 1);
  assert.doesNotMatch(fd, /<AccountBarSlot\b|<FrontDoorAccountBar\b/, 'Discover draws a second account bar');
  assert.doesNotMatch(fd, /\bsn-vt-page\b/, 'two slide elements on Discover — the browser skips the slide');
  assert.ok(!existsSync(join(APP, '_components', 'frontdoor', 'front-door-account-bar.tsx')));
  // Home's page never drew chrome; keep it that way.
  const home = code(join(HUB, 'dashboard', 'page.tsx'));
  assert.doesNotMatch(home, /<(AppRailShell|FrontDoorShell|AccountBarSlot)\b/);
});

test('3b · ONE question decides who draws the shell, asked by both halves', () => {
  const lib = code(join(WEB, 'lib', 'hub-shell.ts'));
  assert.match(lib, /export async function hubDrawsTheShell\(\) \{\s*return getCurrentUser\(\)\.catch\(\(\) => null\);\s*\}/);
  for (const f of [join(HUB, 'layout.tsx'), join(APP, '_components', 'frontdoor', 'front-door.tsx')]) {
    assert.match(code(f), /from '@\/lib\/hub-shell'/, `${f} asks its own question about who is signed in`);
  }
});

test('3c · Home keeps every rule of the dashboard tree — the same gate, imported, plus its add-flow slot', () => {
  const lay = code(join(HUB, 'dashboard', 'layout.tsx'));
  assert.match(lay, /import DashboardLayout from '@\/app\/dashboard\/layout';/);
  assert.match(lay, /<DashboardLayout>\s*\{children\}\s*\{modal\}\s*<\/DashboardLayout>/);
  assert.ok(existsSync(join(HUB, 'dashboard', '@modal', '(.)create-event', 'page.tsx')));
  assert.ok(existsSync(join(HUB, 'dashboard', '@modal', 'default.tsx')));
  assert.ok(existsSync(join(HUB, 'dashboard', 'default.tsx')));
  // The gate still redirects a stranger, so the hub layout may pass a signed-out /dashboard straight through.
  assert.match(code(join(APP, 'dashboard', 'layout.tsx')), /if \(!user\) \{\s*redirect\(loginRedirectPath\('\/dashboard'\)\);/);
});

test('4 · signed out, `/` is the public front door exactly as before', () => {
  const fd = code(join(APP, '_components', 'frontdoor', 'front-door.tsx'));
  const shellBranch = fd.slice(fd.indexOf('<FrontDoorShell'));
  // The stranger's shell: the front-door variant (the default — no `variant=`), its anchor heading, edge to edge.
  assert.doesNotMatch(shellBranch.slice(0, shellBranch.indexOf('>\n')), /variant=/);
  assert.match(shellBranch, /heading=\{account\.signedIn \? undefined : <FrontDoorAnchor \/>\}/);
  assert.match(shellBranch, /bleed=\{signedOut\}/);
  assert.match(fd, /<FrontDoorLanding\b/);
  // The page keeps its metadata and its cron-free jobs (held in detail by their own guards).
  const page = code(join(HUB, 'page.tsx'));
  assert.match(page, /<FrontDoor q=\{q\} params=\{params\} \/>/);
  assert.match(page, /export const revalidate = 300;/);
});
