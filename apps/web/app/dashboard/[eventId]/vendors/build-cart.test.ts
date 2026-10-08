/**
 * build-cart.test.ts — THE CART PEEK of the one-screen Suppliers page (owner
 * 2026-10-07: *"when you click add to build a small pop up showing our build
 * (like a shopping cart pop up)"*; corpus
 * `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1).
 *
 *   T1  the cart peeks only for a pick that SAVED — both shipped "Add to
 *       build" buttons announce after the action answered `ok`, never before,
 *       and a refused pick says nothing;
 *   T2  the peek stays 2.5 s, names who was added, then the build's own count
 *       and total — and its button opens Build over the shipped bus;
 *   T3  there is NO "View this build" pill in the thumb bar (owner 2026-10-07
 *       evening: *the Build segment and the cart peek are the doors*; the
 *       prototype at corpus HEAD draws none);
 *   T4  the peek is drawn into <body> (the dashboard's page wrapper captures
 *       `position: fixed`), and writes nothing.
 *
 * Source assertions, comments stripped — the peek is a portal over
 * `document.body` and this runner has no DOM. The numbers it prints are
 * EXECUTED in `lib/suppliers-shell.test.ts` (`buildTally`, `tallyHasMoney`).
 *
 * SABOTAGE, each seen red (2026-10-08; the PR body has the runs):
 *   T1 announce before the save answers     T2 keep the peek up for 25 s
 *   T3 mount a "View this build" pill       T4 draw the peek in place (no portal)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const DIR = join(WEB, 'app', 'dashboard', '[eventId]', 'vendors');
const code = (...p: string[]) => stripComments(readFileSync(join(DIR, ...p), 'utf8'));

const CART = code('_components', 'build-cart.tsx');
const SHELL = code('_components', 'services-takeover.tsx');
const BUS = stripComments(readFileSync(join(WEB, 'lib', 'budget-build.ts'), 'utf8'));

/* ── T1 · only a saved pick peeks ────────────────────────────────────────── */

test('T1 · both Add-to-build buttons announce AFTER the save answered ok', () => {
  for (const file of ['accordion-build.tsx', 'bench-vendor-actions.tsx']) {
    const src = code('_components', file);
    const pin = src.slice(src.indexOf('const pin = ('), src.indexOf('const unpin = ('));
    assert.ok(pin.length > 0, `${file}: the pin handler moved — re-anchor`);
    const saved = pin.indexOf('const added = await save.run(');
    const said = pin.indexOf('if (added.ok) announceBuildAdded({ name: vendorName, category: groupLabel });');
    assert.ok(saved > -1, `${file}: the pick's result is no longer kept`);
    assert.ok(said > saved, `${file}: the cart is announced before the pick is saved, or unconditionally`);
    assert.equal((src.match(/announceBuildAdded\(/g) ?? []).length, 1, `${file}: a second announcement (Remove must not peek)`);
  }
});

test('T1 · the announcement is one event on the shared bus, beside the tab bus', () => {
  assert.match(BUS, /export const BB_BUILD_ADDED_EVENT = 'bb:build-added';/);
  assert.match(BUS, /window\.dispatchEvent\(new CustomEvent\(BB_BUILD_ADDED_EVENT, \{ detail: added \}\)\)/);
  assert.match(CART, /window\.addEventListener\(BB_BUILD_ADDED_EVENT, onAdded\)/);
  assert.match(CART, /window\.removeEventListener\(BB_BUILD_ADDED_EVENT, onAdded\)/);
  // An event with nobody named is not a pick — it peeks nothing.
  assert.match(CART, /if \(!who\?\.name\) return;/);
});

/* ── T2 · the peek ───────────────────────────────────────────────────────── */

test('T2 · the peek stays 2.5 s, then tucks away', () => {
  assert.match(CART, /export const CART_PEEK_MS = 2500;/);
  assert.match(CART, /timer\.current = window\.setTimeout\(\(\) => setPeekOn\(false\), CART_PEEK_MS\);/);
  // A second pick restarts the clock rather than stacking two timers.
  assert.match(CART, /if \(timer\.current != null\) window\.clearTimeout\(timer\.current\);\s*timer\.current = window\.setTimeout/);
});

test('T2 · two lines — who was added, then the build’s own count and total', () => {
  const peek = CART.slice(CART.indexOf('data-cart-peek'));
  assert.match(peek, /\{added\?\.name\}/);
  assert.match(peek, /\{added\.category\}/);
  assert.match(peek, /This build · <Count value=\{tally\.filled\} id="sup-peek-filled" \/> of\{' '\}\s*<Count value=\{tally\.total\} id="sup-peek-total" \/>/);
  assert.match(peek, /\{withMoney \? \(\s*<b[^>]*>\s*<Count value=\{tally\.knownPhp\} format="peso" id="sup-peek-php" \/>/, 'the total is printed even when nothing is priced');
  // It is announced to a screen reader, and unreachable while tucked away.
  assert.match(peek, /role="status"/);
  assert.match(peek, /inert=\{!peekOn\}/);
  // Its button opens Build over the shipped bus — and nothing else.
  assert.match(peek, /<ActionButton\s+tone="neutral"\s+icon=\{Hammer\}\s+label="View this build"\s+onClick=\{viewBuild\}/);
  assert.match(CART, /const viewBuild = \(\) => \{\s*setPeekOn\(false\);\s*goToBuildTab\('build'\);\s*\};/);
});

/* ── T3 · no pill ────────────────────────────────────────────────────────── */

test('T3 · the thumb bar holds no "View this build" pill — the segment and the peek are the doors', () => {
  // The only "View this build" on the screen is the peek's own button…
  assert.equal((CART.match(/View this build/g) ?? []).length, 1);
  assert.equal((CART.match(/<ActionButton\b/g) ?? []).length, 1, 'a second button in the cart file — the pill is back');
  assert.doesNotMatch(CART, /data-build-pill|pillOn|\bmain\b/);
  // …and the shell mounts the cart with the tally alone: nothing asks for a pill.
  assert.match(SHELL, /<BuildCart tally=\{tally\} \/>/);
  assert.doesNotMatch(SHELL, /View this build|pillOn|pillWanted|data-build-pill/);
  assert.doesNotMatch(CART, /<button\b|›/, 'a hand-made button, or a › inside a control');
});

/* ── T4 · drawn into <body>, and writes nothing ──────────────────────────── */

test('T4 · the peek is drawn into <body>, after mount', () => {
  assert.match(CART, /import \{ createPortal \} from 'react-dom';/);
  assert.match(CART, /useEffect\(\(\) => setHost\(document\.body\), \[\]\);/);
  assert.match(CART, /if \(!host\) return null;\s*return createPortal\(/);
  assert.equal((CART.match(/createPortal\(/g) ?? []).length, 1);
});

test('T4 · nothing here writes — no action is imported or called', () => {
  assert.doesNotMatch(CART, /'use server'|-actions'|\.from\(|fetch\(|router\./);
  const imports = [...CART.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports, [
    'react',
    'react-dom',
    'lucide-react',
    '@/components/action-button',
    '@/components/count',
    '@/lib/budget-build',
    '@/lib/suppliers-shell',
  ]);
});
