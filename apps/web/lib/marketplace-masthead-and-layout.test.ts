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
 * the takeover holds three bodies and their helpers, so a whole-file grep can
 * answer the wrong question. Every assertion below is scoped to the function or
 * the container it is actually about.
 *
 * ── RE-POINTED 2026-10-08 — THE ONE-SCREEN SHELL ─────────────────────────────
 * Owner 2026-10-07 (corpus `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1): the
 * page is Find · Build · Booked over ONE body. B1's chip list became the
 * segmented control and B3's 380px rail is gone, so those two sections are
 * restated for the new shape rather than deleted: same bus, no re-typed
 * labels, no second pinned bar, Plans mounted once at full width.
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
// The chips became the "Your planning" list (2026-10-03), and that list became
// the ONE segmented control of the one-screen shell (owner 2026-10-07; corpus
// `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1) — same bus, in the takeover itself.
const SHELL_RULES = 'lib/suppliers-shell.ts';

/** The shell's own function — props, hooks and render — up to the next
 *  top-level function, so an assertion about the control cannot accidentally
 *  be satisfied by a helper 200 lines away. (Sliced to the NEXT function, not
 *  to the first column-0 `}`: for a component with a typed props object that
 *  brace is the end of its PARAMETERS.) */
function shellBody(): string {
  const src = code(TAKEOVER);
  const start = src.indexOf('export function ServicesTakeover(');
  assert.notEqual(start, -1, 'ServicesTakeover must exist to be asserted about');
  const end = src.indexOf('\nfunction ServiceSection(', start);
  assert.notEqual(end, -1, 'ServiceSection moved — re-anchor the end of the shell');
  const body = src.slice(start, end);
  assert.ok(body.includes('return ('), 'the slice lost the render — it would prove nothing');
  return body;
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
  // Renamed "Suppliers" (owner 2026-10-01 — the bar is Home · Guests · Suppliers · Hub · More).
  assert.match(src, /title="Suppliers"/);
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
   B1 · ONE CONTROL SWAPS ONE BODY — OVER THE SHIPPED BUS
   (Was "the chips scroll, they do not swap": the page was one tall scroll and a
   chip only moved you down it. Owner 2026-10-07 made it one screen with three
   modes, so the control now DOES swap the body — and what this section always
   protected is unchanged: no second channel, no re-typed labels.)
   ═══════════════════════════════════════════════════════════════════════════ */

test('a segment calls the SHIPPED bus — it does not build a second channel', () => {
  // The paid-twice mistake this surface already made once. A press goes through
  // `goToBuildTab`, which dispatches the existing event the takeover's own
  // listener consumes — no new key, no new event, no handler of its own.
  const shell = shellBody();
  assert.match(shell, /onClick=\{\(\) => goToBuildTab\(SUPPLIERS_MODE_TAB\[m\]\)\}/, 'a segment must dispatch the existing bus');
  assert.doesNotMatch(shell, /onClick=\{\(\) => setMode\(/, 'a segment sets the mode behind the bus’s back');
  assert.equal((code(TAKEOVER).match(/new CustomEvent\(/g) ?? []).length, 0, 'the takeover dispatches an event of its own');
});

test('segment labels come from the one module, never authored in the takeover', () => {
  const shell = shellBody();
  assert.match(shell, /\{SUPPLIERS_MODE_LABEL\[m\]\}/);
  assert.doesNotMatch(shell, />\s*(Find|Build|Booked)\s*</, 'a segment’s word is typed in the takeover');
  // …and that module says Find · Build · Booked.
  assert.match(code(SHELL_RULES), /find: 'Find',\s*build: 'Build',\s*booked: 'Booked',/);
});

test('the segments iterate the one ordered mode list, and every mode key is a shipped tab', () => {
  // `suppliers-shell.test.ts` executes that every bus key opens a body and each
  // body owns one key; here, that the segments are mapped from the list.
  assert.match(shellBody(), /SUPPLIERS_MODES\.map\(/);
  assert.match(code(SHELL_RULES), /find: 'shortlist',\s*build: 'build',\s*booked: 'budget',/);
});

test('ONE pinned block, and nothing in the takeover is fixed', () => {
  // The line and the control stay as the page scrolls (owner 2026-10-07: "this
  // will stay prominent when scrolled up?"). A SECOND pinned bar under it is
  // the stacked-bars defect `lint-no-stacked-pinned-bars.mjs` exists for; the
  // cart peek is `build-cart.tsx`'s, drawn into <body>.
  const src = code(TAKEOVER);
  assert.equal((src.match(/(?<![:\w-])sticky(?![\w-])/g) ?? []).length, 1, 'a second pinned bar');
  assert.doesNotMatch(src, /(?<![:\w-])fixed(?![\w-])/);
});

test('the control is not a <SubNav>', () => {
  // Same rule the team chip carried: SubNav increments the docked-count store
  // and collapses the bottom nav. The control borrows nothing from it.
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
   B3 · PLANS HAS THE BODY'S FULL WIDTH — THE 380px RAIL IS GONE
   (B3 moved "Your plans" out of a fixed 380px rail, where a side-by-side table
   had ~330px. The one-screen shell retires the rail altogether: Build is one
   column and the saved builds sit under the picks, full width.)
   ═══════════════════════════════════════════════════════════════════════════ */

test('Plans is mounted in the Build body, with no rail beside it', () => {
  const src = code(TAKEOVER);
  const at = src.indexOf('data-suppliers-body="build"');
  assert.notEqual(at, -1, 'the Build body must exist');
  const body = src.slice(at, src.indexOf('data-suppliers-body="booked"'));
  assert.match(body, /<ServiceSection tab="compare"/, 'the Build body must hold Plans');
  assert.doesNotMatch(src, /380px|lg:col-span-2|lg:sticky/, 'the fixed rail is back — a table cannot live in it');
});

test('Plans is MOVED, not duplicated — no display-toggled second mount', () => {
  // The mistake this catches was nearly shipped: `lg:hidden` + `hidden lg:block`
  // reads like a move but is `display`, so BOTH copies stay in the DOM —
  // duplicate `#svc-compare` ids and two mounts of the panel's client state.
  const src = code(TAKEOVER);
  assert.doesNotMatch(src, /lg:hidden/);
  assert.equal((src.match(/<ServiceSection tab="compare"/g) ?? []).length, 1);
});

test('the keys that resolve by id are untouched', () => {
  // What makes any move safe at all: `#svc-*`, `?tab=` and BB_TAB_EVENT resolve
  // by id, never by DOM position. All four section keys must still be reachable.
  const src = code(TAKEOVER);
  assert.match(src, /`svc-\$\{tab\}`/, 'the #svc-<tab> anchor id builder');
  assert.match(src, /BB_TAB_EVENT/);
  assert.match(src, /searchParams\.set\('tab', next\)/, "?tab= is still mirrored");
  for (const tab of ['shortlist', 'build', 'compare', 'budget']) {
    assert.equal((src.match(new RegExp(`<ServiceSection tab="${tab}"`, 'g')) ?? []).length, 1, `#svc-${tab} is gone or doubled`);
  }
});
