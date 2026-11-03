/**
 * 🐞 A FILTERED, GROUPED LIST STILL FOLDS (owner, 3 Nov 2026, verbatim: "when using filter and picking on show and
 * group by and the rest of the choices, i cannot collapse the search results group").
 *
 * The narrowed list (a search, a Show or a +1 filter) answered "open" for every heading whatever the host tapped, so
 * the header tap — and ⇕ Collapse all — did nothing. These checks drive the fold state the screen draws from
 * (`section-fold.ts`), then hold the screen to it: its `isOpen` reads it, its header tap and ⇕ write it, and no early
 * return makes a search's headings untappable.
 *
 * Run: cd apps/web && npx tsx --test 'app/dashboard/[[]eventId]/guests/_components/a-filtered-group-folds.test.ts'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_FOLDS, foldNarrowed, narrowingOf, sectionIsOpen, type NarrowFolds } from './section-fold';

const KEYS = ['side:bride', 'side:groom', 'side:both'];
const screen = readFileSync(join(__dirname, 'guests-screen.tsx'), 'utf8');

/** A stand-in for the screen: the whole list's `open`, the narrowed list's folds, and one header tap. */
function list(open: Set<string> = new Set([KEYS[0]!])) {
  let folds: NarrowFolds = NO_FOLDS;
  let narrowing: string | null = null;
  const isOpen = (k: string) => sectionIsOpen(k, { narrowing, open, folds });
  return {
    isOpen,
    narrow(parts: { q?: string; show?: string | null; plus?: string | null; group: string }) {
      narrowing = narrowingOf({ q: parts.q ?? '', show: parts.show ?? null, plus: parts.plus ?? null, group: parts.group });
    },
    tap(k: string) {
      const opening = !isOpen(k);
      if (narrowing !== null) folds = foldNarrowed(folds, narrowing, [k], opening);
      else if (opening) open.add(k);
      else open.delete(k);
    },
    all(opening: boolean) {
      if (narrowing !== null) folds = foldNarrowed(folds, narrowing, KEYS, opening);
    },
  };
}

test('Show + Group by: every heading arrives open, and a tap folds then unfolds it', () => {
  const l = list();
  l.narrow({ show: 'attending', group: 'side' });
  assert.deepEqual(KEYS.map(l.isOpen), [true, true, true], 'a hit inside a folded heading would look like "not found" (G19)');
  l.tap('side:groom');
  assert.equal(l.isOpen('side:groom'), false, 'the filtered heading did not fold — the owner’s 3 Nov bug');
  assert.equal(l.isOpen('side:bride'), true, 'folding one heading folded another');
  l.tap('side:groom');
  assert.equal(l.isOpen('side:groom'), true, 'the folded heading did not open again');
});

test('a search folds the same way', () => {
  const l = list();
  l.narrow({ q: 'reyes', group: 'role' });
  l.tap('side:both');
  assert.equal(l.isOpen('side:both'), false);
});

test('⇕ Collapse all / Expand all work on a narrowed list', () => {
  const l = list();
  l.narrow({ show: 'pending', group: 'side' });
  l.all(false);
  assert.deepEqual(KEYS.map(l.isOpen), [false, false, false], 'Collapse all left a filtered heading open');
  l.all(true);
  assert.deepEqual(KEYS.map(l.isOpen), [true, true, true]);
});

test('a new narrowing opens every hit again; the whole list keeps its own folds', () => {
  const l = list(new Set([KEYS[0]!]));
  l.narrow({ show: 'attending', group: 'side' });
  l.tap('side:bride');
  l.narrow({ show: 'declined', group: 'side' });
  assert.equal(l.isOpen('side:bride'), true, 'a fold made under one Show leaked into the next');
  l.narrow({ show: 'declined', group: 'group' });
  assert.equal(l.isOpen('side:bride'), true, 'a fold survived a new Group by');
  l.narrow({ group: 'side' }); // filter cleared
  assert.deepEqual(KEYS.map(l.isOpen), [true, false, false], 'clearing the filter lost the whole list’s own open headings');
});

test('the screen draws from section-fold, and its taps write to it', () => {
  assert.match(screen, /const isOpen = \(key: string\) => sectionIsOpen\(key, \{ narrowing, open, folds: narrowFolds \}\)/, 'isOpen no longer reads the fold state');
  assert.doesNotMatch(screen, /q \|\| filtered \? true/, 'a narrowed list answers "open" for every heading again — taps do nothing');
  const tap = screen.slice(screen.indexOf('const tapSection'), screen.indexOf('const fileOptions'));
  assert.ok(tap.length > 0, 'tapSection moved — re-anchor this test');
  assert.doesNotMatch(tap, /if \(q\) return/, 'a search makes its headings untappable again');
  assert.match(tap, /foldSections\(\[key\], opening\)/, 'the header tap no longer folds through foldSections');
  assert.match(screen, /onClick: \(\) => foldSections\(sections\.map\(\(s\) => s\.key\), !allOpen\)/, '⇕ no longer folds a narrowed list');
});
