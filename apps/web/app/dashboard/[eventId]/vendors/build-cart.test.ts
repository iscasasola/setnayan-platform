/**
 * build-cart.test.ts — THE THUMB PILL AND THE CART PEEK of the one-screen
 * Suppliers page (owner 2026-10-07: *"when you click add to build a small pop
 * up showing our build (like a shopping cart pop up)"*; corpus
 * `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1).
 *
 *   T1  the cart peeks only for a pick that SAVED — both shipped "Add to
 *       build" buttons announce after the action answered `ok`, never before,
 *       and a refused pick says nothing;
 *   T2  the peek stays 2.5 s, names who was added, then the build's own count
 *       and total — and its button opens Build over the shipped bus;
 *   T3  the pill is the shipped ActionButton (neutral · main = the ink fill),
 *       its figures run on the one counting engine, and it is offered in Find
 *       only, once anything is picked — sliding down before the body swaps;
 *   T4  both are drawn into <body> (the dashboard's page wrapper captures
 *       `position: fixed`), and neither writes anything.
 *
 * Source assertions, comments stripped — the pieces are a portal over
 * `document.body` and this runner has no DOM. The words and the numbers they
 * print are EXECUTED in `lib/suppliers-shell.test.ts` (`buildTallyLine`).
 *
 * SABOTAGE, each seen red before this shipped (PR body has the runs):
 *   T1 announce before the save answers     T2 keep the peek up for 25 s
 *   T3 offer the pill in every mode         T4 draw the pill in place (no portal)
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

/* ── T3 · the pill ───────────────────────────────────────────────────────── */

test('T3 · the pill is the shipped button, filled in ink, with counted figures', () => {
  const pill = CART.slice(CART.indexOf('data-build-pill'), CART.indexOf('data-cart-peek'));
  assert.match(pill, /<ActionButton\s+tone="neutral"\s+main\s+icon=\{Hammer\}/);
  assert.match(pill, /label=\{`View this build · \$\{buildTallyLine\(\{ filled, total, knownPhp \}, withMoney\)\}`\}/);
  assert.match(pill, /onClick=\{viewBuild\}/);
  assert.doesNotMatch(CART, /<button\b|›/, 'a hand-made button, or a › inside a control');
  // Every number counts to its value — the one engine, keyed so a re-render does not replay.
  for (const [name, id] of [['filled', 'sup-pill-filled'], ['total', 'sup-pill-total'], ['knownPhp', 'sup-pill-php']] as const) {
    assert.match(CART, new RegExp(`const ${name} = useCountTo\\(tally\\.${name}, \\{ id: '${id}' \\}\\);`));
  }
  // Whether there is a peso figure at all is decided from the REAL tally.
  assert.match(CART, /const withMoney = tallyHasMoney\(tally\);/);
});

test('T3 · the pill is offered in Find only, once anything is picked — and slides before the body swaps', () => {
  assert.match(SHELL, /const pillWanted = mode === 'find' && tally\.filled > 0;/);
  assert.match(SHELL, /const pillOn = risen && !leavingFind;/);
  assert.match(SHELL, /<BuildCart tally=\{tally\} pillOn=\{pillOn\} \/>/);
  // It slides UP once the mode has rendered (two frames), never pops in — and
  // is taken down the moment it is not wanted.
  const rise = SHELL.slice(SHELL.indexOf('const pillWanted'), SHELL.indexOf('const [leavingFind'));
  assert.match(rise, /if \(!pillWanted\) \{\s*risenRef\.current = false;\s*setRisen\(false\);\s*return;\s*\}/);
  assert.match(rise, /requestAnimationFrame\(\(\) => \{\s*inner = requestAnimationFrame\(\(\) => \{\s*risenRef\.current = true;\s*setRisen\(true\);/);
  // …and slides DOWN first when the couple leaves Find (reduced motion: at once).
  const goTo = SHELL.slice(SHELL.indexOf('const goToSection'), SHELL.indexOf('}, []);', SHELL.indexOf('const goToSection')));
  assert.match(
    goTo,
    /if \(nextMode !== modeRef\.current && risenRef\.current && !prefersReducedMotion\(\)\) \{\s*setLeavingFind\(true\);\s*leaving\.current = window\.setTimeout\(swap, THUMB_SLIDE_MS\);\s*return;\s*\}/,
  );
  // The swap ends the leaving — so a second press on Find brings the pill back.
  assert.match(goTo, /flushSync\(\(\) => \{[\s\S]*?setLeavingFind\(false\);\s*\}\);/);
  assert.match(CART, /export const THUMB_SLIDE_MS = 300;/);
  assert.match(CART, /style=\{\{ transitionDuration: `\$\{THUMB_SLIDE_MS\}ms` \}\}/, 'the slide and the wait before the swap can drift apart');
  assert.match(CART, /inert=\{!pillOn\}/);
});

/* ── T4 · drawn into <body>, and writes nothing ──────────────────────────── */

test('T4 · both pieces are drawn into <body>, after mount', () => {
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
