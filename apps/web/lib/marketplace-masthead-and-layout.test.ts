/**
 * marketplace-masthead-and-layout.test.ts — the wiring facts behind B1 · B2 · B3.
 *
 * ── WHY SOURCE ASSERTIONS ────────────────────────────────────────────────────
 * Same constraint as `team-summary-chip.test.ts` and `bench-deep-link-anchor.test.ts`:
 * this runner is `tsx --test` with no jsdom, and these components are a client
 * takeover fed by a ~2100-line server page. B5's derivation was therefore
 * EXTRACTED to a pure core and is tested for real in `compare-anchored-date.test.ts`.
 * What is left here is wiring — where a thing mounts and what it must not be —
 * and each of those is something a later edit can silently undo.
 *
 * ── THE TRAP THESE AVOID ─────────────────────────────────────────────────────
 * A file-level substring count cannot say WHICH component still renders a thing:
 * this file contains `lg:sticky` (the rail) and two `tab="compare"` mounts (the
 * replan one and the flag-OFF one), so a whole-file grep would answer the wrong
 * question. Every assertion below is scoped to the function or the container it
 * is actually about.
 *
 * MUTATION-CHECKED — occurrence counts printed before → after in the PR body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => readFileSync(resolve(WEB, rel), 'utf8');

/** Source with comments stripped — this file documents the very things its
 *  "must NOT appear" assertions forbid, so a raw substring check would read the
 *  documentation as the violation. (`team-summary-chip.test.ts`'s own lesson.) */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

const TAKEOVER = 'app/dashboard/[eventId]/vendors/_components/services-takeover.tsx';
const COMPONENTS = 'app/dashboard/[eventId]/vendors/_components';

/** The body of a top-level `function <name>(` — so an assertion about the chips
 *  cannot accidentally be satisfied by the rail 200 lines away. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist to be asserted about`);
  const end = src.indexOf('\n}', start);
  assert.notEqual(end, -1, `${name} must be a top-level function`);
  return src.slice(start, end);
}

/* ═══════════════════════════════════════════════════════════════════════════
   B1 · THE PAGE SAYS WHICH PAGE IT IS
   ═══════════════════════════════════════════════════════════════════════════ */

test('the Marketplace mounts <PageMasthead> — it had NO h1 at all', () => {
  // Measured 2026-08-14: the only <h1>s under vendors/ were its SUB-routes
  // (review · workspace · categories · packages). The shell supplies the <main>
  // landmark and no heading, the desktop tab strip went 2026-07-15 and the
  // mobile dock went under the replan flag — so on a phone, where there is no
  // sidebar to read, nothing on screen said which page this was.
  const src = code(TAKEOVER);
  assert.match(src, /<PageMasthead\b/, 'the masthead must be MOUNTED, not merely imported');
  assert.match(src, /title="Your Team"/);
});

test('the masthead is the shared component, never a hand-roll', () => {
  // `lint-page-masthead.mjs` exists because ~80 pages each hand-rolled this
  // block and a CARD token drifted onto all of them.
  assert.match(
    code(TAKEOVER),
    /import \{ PageMasthead \} from '@\/app\/_components\/page-masthead'/,
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   B1 · THE CHIPS SCROLL. THEY DO NOT SWAP.
   ═══════════════════════════════════════════════════════════════════════════ */

test('a chip calls the SHIPPED bus — it does not rebuild panel switching', () => {
  // The paid-twice mistake this surface already made once. The desktop strip was
  // removed 2026-07-15; `?tab=` and BB_TAB_EVENT still work but SCROLL. A chip
  // must go through `goToBuildTab`, which dispatches the existing event the
  // takeover's own listener consumes — no new key, no new anchor, no new state.
  const chips = fnBody(code(TAKEOVER), 'SectionChips');
  assert.match(chips, /goToBuildTab\(/, 'chips must dispatch the existing bus');
  assert.doesNotMatch(chips, /useState|setCompareOpen|setBudgetOpen/, 'no local panel state');
});

test('chip labels come from tabLabel(), never authored here', () => {
  // `tabLabel()` is flag-gated, so the chips say "Payments"/"Plans" with the
  // flag on and the pre-rename words with it off. Hardcoding a label is how the
  // two drift.
  const chips = fnBody(code(TAKEOVER), 'SectionChips');
  assert.match(chips, /tabLabel\(/);
  assert.doesNotMatch(chips, /'Payments'|'Plans'|"Payments"|"Plans"/);
});

test('the chips iterate BUDGET_BUILD_TABS rather than re-listing the four', () => {
  // A re-listed array is a second source of truth for the section set.
  assert.match(fnBody(code(TAKEOVER), 'SectionChips'), /BUDGET_BUILD_TABS\.map/);
});

test('the chip row is NOT a third pinned bar', () => {
  // The bottom nav and the team chip already dock on mobile. A third pinned bar
  // is the stacked-bars defect `lint-no-stacked-pinned-bars.mjs` exists for.
  // Scoped to the function: this FILE legitimately contains `lg:sticky` (the rail).
  const chips = fnBody(code(TAKEOVER), 'SectionChips');
  assert.doesNotMatch(chips, /\bfixed\b|\bsticky\b/);
});

test('the chip row is not a <SubNav>', () => {
  // Same rule the team chip carries: SubNav increments the docked-count store
  // and collapses the bottom nav. The chips borrow geometry only.
  assert.doesNotMatch(code(TAKEOVER), /\bSubNav\b/);
});

/* ═══════════════════════════════════════════════════════════════════════════
   B2 · THE SKIN, AND ONE HONEST SENTENCE
   ═══════════════════════════════════════════════════════════════════════════ */

test('no glass-era bg-white/N survives in the Marketplace components', () => {
  // The 2026-08-08 warm-editorial pass shipped as ONE edit to the shared `.sn-*`
  // recipes, so it reached every surface that USES them and no surface that
  // hand-rolls its own. This one hand-rolled everything — measured 2026-08-14,
  // ZERO `.sn-tile`/`.sn-card`/`.sn-glass` across its seven components — which
  // is why `bg-white/60` was still sitting on the payments lens months after
  // design#6 stripped that exact fill from the public doorways.
  const offenders = readdirSync(resolve(WEB, COMPONENTS))
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => /bg-white\/\d/.test(code(join(COMPONENTS, f))));
  assert.deepEqual(offenders, [], `glass fill left in: ${offenders.join(', ')}`);
});

test('the payments lens wears the warm-editorial card', () => {
  assert.match(code(join(COMPONENTS, 'merkado-budget-lens.tsx')), /className="sn-tile/);
});

test('the crest no longer tells every couple they are on a premium tier', () => {
  // `premium` is `aiActive`, and while the AI paywall is off `aiActive` is true
  // for EVERY event — so a line meant to mark a paid tier was telling all of
  // them they had bought something. The features it names are genuinely on;
  // what was false was "premium tier".
  const src = code(TAKEOVER);
  assert.doesNotMatch(src, /premium tier/i);
  assert.match(src, /free while we are in launch/);
});

/* ═══════════════════════════════════════════════════════════════════════════
   B3 · PLANS LEAVES THE 380px RAIL
   ═══════════════════════════════════════════════════════════════════════════ */

test('the replan Plans mount spans both columns, outside the rail', () => {
  // A side-by-side table cannot live in a fixed 380px column (~330px usable,
  // behind an overflow-x-auto). Scoped to the container, not the file: this file
  // has TWO `tab="compare"` mounts — the replan one and the flag-OFF one — so a
  // whole-file grep would prove nothing about which of them moved.
  const src = code(TAKEOVER);
  const at = src.indexOf('lg:col-span-2');
  assert.notEqual(at, -1, 'the full-width Plans container must exist');
  const container = src.slice(at, at + 400);
  assert.match(container, /tab="compare"/, 'the full-width container must hold Plans');
});

test('Plans is MOVED, not duplicated — no display-toggled second mount', () => {
  // The mistake this catches was nearly shipped: `lg:hidden` + `hidden lg:block`
  // reads like a move but is `display`, so BOTH copies stay in the DOM —
  // duplicate `#svc-compare` ids and two mounts of the panel's client state.
  assert.doesNotMatch(code(TAKEOVER), /lg:hidden/);
});

test('the rail keeps its sticky behaviour', () => {
  // Only Plans left. Team + Payments still ride the sticky 380px rail.
  assert.match(code(TAKEOVER), /lg:sticky lg:top-4/);
});

test('the keys that resolve by id are untouched', () => {
  // What makes the move safe at all: `#svc-*`, `?tab=` and BB_TAB_EVENT resolve
  // by id, never by DOM position. All four section keys must still be reachable.
  const src = code(TAKEOVER);
  assert.match(src, /`svc-\$\{tab\}`/, 'the #svc-<tab> anchor id builder');
  assert.match(src, /BB_TAB_EVENT/);
  assert.match(src, /searchParams\.set\('tab', next\)/, "?tab= is still mirrored");
});
