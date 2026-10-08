/**
 * find-thumb-row.test.ts — THE FLOATING ROW AT THE THUMB OF FIND (owner
 * 2026-10-07 evening; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR2
 * "UPDATED 2026-10-07 EVENING / LATE"; acceptance pictures 19–22):
 * ⇕ Expand all · Search all suppliers or add your own · ＋ Add your own.
 *
 *   T1  the row owns nothing and writes nothing — its three controls are the
 *       bench's own (open state, search text, the add form);
 *   T2  rule 4 — the box keeps its own text and the list hears it 250 ms after
 *       the last keystroke; the bench's old in-list search box is gone;
 *   T3  rule 5 — it rises once Find is on screen and slides down BEFORE the
 *       body swaps; a hidden Find body takes its row down;
 *   T4  rules 3 and 7 — one fit state for the row, the field keeps 60 %; the
 *       field is the frosted piece and Add keeps its full colour;
 *   T5  Expand all opens every category and a header tap folds just that one;
 *   T6  ＋ Add your own opens the form for the ONE open category, otherwise it
 *       asks which first — one dropdown of only the categories on the event.
 *
 * Source assertions, comments stripped: the row is a portal over
 * `document.body` and this runner has no DOM. The open rule itself is EXECUTED
 * in `lib/suppliers-shell.test.ts` (`isCategoryOpen`), and the glass recipe in
 * `lib/floating-rows-are-glass.test.ts`.
 *
 * SABOTAGE, each seen red (2026-10-08; the PR body has the runs):
 *   T1 the row calls the search action itself   T2 search on every keystroke ·
 *   keep the in-list box   T3 stay up while Find is hidden · swap without the wait
 *   T4 drop the fit pass · frost Add   T5 a header tap closes them all
 *   T6 list every category in the dropdown
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors', '_components');
const code = (f: string) => stripComments(readFileSync(join(DIR, f), 'utf8'));

const ROW = code('find-thumb-row.tsx');
const BENCH = code('shortlist-categories.tsx');
const SHELL = code('services-takeover.tsx');
const MODE = code('suppliers-mode.tsx');

/* ── T1 ──────────────────────────────────────────────────────────────────── */

test('T1 · the row owns nothing and writes nothing', () => {
  const imports = [...ROW.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports, ['react', 'react-dom', 'lucide-react', '@/components/action-button', './suppliers-mode']);
  assert.doesNotMatch(ROW, /'use server'|-actions'|_actions\/|\.from\(|fetch\(|router\./);
  // The bench hands it its own three controls — once.
  assert.equal((BENCH.match(/<FindThumbRow\b/g) ?? []).length, 1);
  assert.match(
    BENCH,
    /<FindThumbRow\s+allOpen=\{openAll\}\s+onToggleAll=\{toggleOpenAll\}\s+scope="all suppliers"\s+onSearch=\{setQuery\}\s+onAdd=\{addYourOwn\}\s+\/>/,
  );
  // Every control is the shipped button; nothing hand-made, no › in a control.
  assert.equal((ROW.match(/<ActionButton\b/g) ?? []).length, 2);
  assert.doesNotMatch(ROW, /<button\b|›/);
});

/* ── T2 · rule 4 ─────────────────────────────────────────────────────────── */

test('T2 · the search runs 250 ms after the last keystroke, and typing never rebuilds the box', () => {
  assert.match(ROW, /export const THUMB_SEARCH_DEBOUNCE_MS = 250;/);
  // The box's text is the row's own state — the list is told later.
  assert.match(ROW, /const \[text, setText\] = useState\(''\);/);
  assert.match(ROW, /value=\{text\}\s+onChange=\{\(e\) => setText\(e\.target\.value\)\}/);
  assert.match(
    ROW,
    /const t = window\.setTimeout\(\(\) => \{\s*said\.current = text;\s*onSearch\(text\);\s*\}, THUMB_SEARCH_DEBOUNCE_MS\);\s*return \(\) => window\.clearTimeout\(t\);/,
  );
  assert.doesNotMatch(ROW, /onChange=\{[^}]*onSearch\(/, 'the list is searched on every keystroke');
  // The words say what the box searches.
  assert.match(ROW, /const words = `Search \$\{scope\} or add your own`;/);
  assert.match(ROW, /placeholder=\{words\}\s+aria-label=\{words\}/);
});

test('T2 · the bench’s in-list search box is gone with the new shape — one box, at the thumb', () => {
  const at = BENCH.indexOf('<div className="bench-search">');
  assert.ok(at > -1, 'the flag-off box moved — re-anchor');
  assert.match(BENCH.slice(at - 60, at), /\{replan \? null : \(\s*$/, 'the old box is drawn beside the thumb row');
});

/* ── T3 · rule 5 ─────────────────────────────────────────────────────────── */

test('T3 · it rises once Find is on screen, and a hidden Find body takes its row down', () => {
  assert.match(ROW, /const \{ mode, leaving, thumbUp \} = useSuppliersMode\(\);/);
  assert.match(ROW, /const wanted = mode === 'find' && !leaving;/);
  assert.match(ROW, /if \(!wanted\) \{\s*thumbUp\.current = false;\s*setUp\(false\);\s*return;\s*\}/);
  assert.match(ROW, /inner = requestAnimationFrame\(\(\) => \{\s*thumbUp\.current = true;\s*setUp\(true\);/);
  assert.match(ROW, /inert=\{!up\}/);
  assert.match(ROW, /style=\{\{ transitionDuration: `\$\{THUMB_SLIDE_MS\}ms` \}\}/);
  // Unmounting says the row is down, so the shell never waits for a row that is gone.
  assert.match(ROW, /useEffect\(\s*\(\) => \(\) => \{\s*thumbUp\.current = false;\s*\},\s*\[thumbUp\],\s*\);/);
  // The shell is what tells every body which one is on screen.
  assert.match(SHELL, /const modeState = useMemo\(\(\) => \(\{ mode, leaving, thumbUp \}\), \[mode, leaving\]\);/);
  assert.match(SHELL, /<SuppliersModeContext\.Provider value=\{modeState\}>/);
  // Outside the shell a body renders as it would alone: Find, on screen, not leaving.
  assert.match(MODE, /createContext<SuppliersModeState>\(\{\s*mode: 'find',\s*leaving: false,\s*thumbUp: \{ current: false \},\s*\}\)/);
});

test('T3 · the body swaps only AFTER the row has slid down — and only when a row is up', () => {
  const goTo = SHELL.slice(SHELL.indexOf('const goToSection'), SHELL.indexOf('}, []);', SHELL.indexOf('const goToSection')));
  assert.match(
    goTo,
    /if \(nextMode !== modeRef\.current && thumbUp\.current && !prefersReducedMotion\(\)\) \{\s*setLeaving\(true\);\s*leaveTimer\.current = window\.setTimeout\(swap, THUMB_SLIDE_MS\);\s*return;\s*\}\s*swap\(\);/,
  );
  // The swap ends the wait — so a second press on the body being left brings its row back.
  assert.match(goTo, /flushSync\(\(\) => \{[\s\S]*?setLeaving\(false\);\s*\}\);/);
  assert.match(goTo, /if \(leaveTimer\.current != null\) window\.clearTimeout\(leaveTimer\.current\);/);
  assert.match(MODE, /export const THUMB_SLIDE_MS = 300;/);
});

/* ── T4 · rules 3 and 7 ──────────────────────────────────────────────────── */

test('T4 · one fit state for the row; the field keeps its share', () => {
  assert.match(ROW, /const rowRef = useRef<HTMLDivElement>\(null\);\s*useFitRow\(rowRef\);/);
  assert.match(ROW, /<div ref=\{rowRef\} className="[^"]*\bmin-w-0\b[^"]*">/);
  // The LABEL is the field the fit pass measures (it holds the icon and the input).
  assert.match(ROW, /<label\s+data-glass-row="suppliers-find"\s+data-fit-field=""/);
});

test('T4 · glass: the row has no background; the field is frosted; Add keeps its full colour', () => {
  const outer = /<div\s+data-find-thumb=""[\s\S]*?className=\{`([^`]*)`\}/.exec(ROW)?.[1] ?? '';
  assert.ok(outer, 'the row lost its anchor');
  assert.doesNotMatch(outer, /(^| )(bg-|shadow|backdrop-blur|sn-glass-row)/, 'the row has a fill, a shadow or a blur of its own');
  assert.match(ROW, /<label\s+data-glass-row="suppliers-find"\s+data-fit-field=""\s+className="sn-glass-row /);
  // Add: terracotta, filled, at every width — and NOT the fit pass's "main",
  // so on a phone it drops its word with the rest of the row (the ＋ circle).
  assert.match(ROW, /const ADD_FILLED = '!border-mulberry !bg-mulberry !text-white';/);
  assert.match(ROW, /<ActionButton tone="brand" icon=\{Plus\} label="Add your own" onClick=\{onAdd\} className=\{ADD_FILLED\} \/>/);
  assert.doesNotMatch(ROW, /\bmain\b(?!\s*verb)/, 'a `main` button never drops its word — the row would not fit a phone');
});

/* ── T5 · expand all ─────────────────────────────────────────────────────── */

test('T5 · Expand all opens every category; a header tap then folds just that one', () => {
  assert.match(BENCH, /const tileOpen = isCategoryOpen\(\{ tile: t\.tile, searching, openTile, openAll, folded \}\);/);
  assert.match(BENCH, /const folderOpen = searching \|\| openAll \|\| openFolder === folder\.folder;/);
  assert.match(BENCH, /onClick=\{\(\) => \(openAll \? toggleFolded\(t\.tile\) : setOpenTile\(tileOpen \? null : t\.tile\)\)\}/);
  const toggle = BENCH.slice(BENCH.indexOf('function toggleOpenAll()'), BENCH.indexOf('const benchRows'));
  assert.match(toggle, /setFolded\(new Set\(\)\);/, 'a stale fold would survive the next Expand all');
  assert.match(toggle, /setOpenAll\(\(on\) => \{\s*if \(on\) \{\s*setOpenFolder\(null\);\s*setOpenTile\(null\);\s*\}\s*return !on;\s*\}\);/);
  // The control says what it will do, and whether everything is open.
  assert.match(ROW, /label=\{allOpen \? 'Collapse all' : 'Expand all'\}\s+aria-expanded=\{allOpen\}/);
});

/* ── T6 · add your own ───────────────────────────────────────────────────── */

test('T6 · Add opens the form for the ONE open category — otherwise it asks which, first', () => {
  const add = BENCH.slice(BENCH.indexOf('function addYourOwn()'), BENCH.indexOf('function openPlan('));
  assert.match(add, /const open = !openAll && !searching && openTile \? benchRows\.find\(\(r\) => r\.t\.tile === openTile\) : null;/);
  assert.match(add, /if \(open\) setManual\(\{ category: open\.t\.category, label: open\.t\.label \}\);\s*else setAddAsk\(true\);/);
  // The shipped form — never a second one.
  assert.equal((BENCH.match(/<NewManualVendorModal\b/g) ?? []).length, 2, 'a third manual-supplier form');
});

test('T6 · the question is ONE dropdown of only the categories on the event', () => {
  // "On the event" is the bench's own row set — the in-plan tiles.
  assert.match(
    BENCH,
    /const benchRows = folders\.flatMap\(\(f\) =>\s*f\.tiles\.filter\(\(t\) => !inPlanTiles \|\| inPlanTiles\.has\(t\.tile\)\)\.map\(\(t\) => \(\{ t, group: f\.label \}\)\),\s*\);/,
  );
  const ask = BENCH.slice(BENCH.indexOf('{addAsk &&'), BENCH.indexOf('{manual ? ('));
  assert.ok(ask.length > 0, 'the ask moved — re-anchor');
  assert.equal((ask.match(/<PickMenu\b/g) ?? []).length, 1, 'more than one control asks the category');
  assert.match(ask, /options=\{benchRows\.map\(\(\{ t, group \}\) => \(\{ key: t\.tile, label: t\.label, group \}\)\)\}/);
  assert.match(ask, /setAddAsk\(false\);\s*if \(row\) setManual\(\{ category: row\.t\.category, label: row\.t\.label \}\);/);
  // A sheet must escape the page's transform.
  assert.match(ask, /createPortal\(\s*<Sheet open onClose=\{\(\) => setAddAsk\(false\)\}[\s\S]*document\.body,\s*\)/);
  assert.doesNotMatch(ask, /<select\b|role="radio"/);
});
