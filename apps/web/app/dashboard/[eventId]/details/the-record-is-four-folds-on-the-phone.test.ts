/**
 * the-record-is-four-folds-on-the-phone.test.ts — Event Details on a phone is
 * FIVE folded groups (the fifth, Event access, owner 2026-10-07), one line + summary each, ONE OPEN AT A TIME; the
 * Finish-your-Event-Hub card sits on top; a desktop keeps every group open.
 *
 * ⚖ Owner 2026-10-04 (DECISION_LOG "EVENT DETAILS / MAKER: FOUR FIXES BEFORE
 * BUILD" (2)): *"Event Details on the phone = four folded groups with one-line
 * summaries (How it looks · How it works · Your event · Guests & money); tap
 * opens a group"* — and "ONE OPEN AT A TIME": *"when a dropdown opens, the
 * other dropdown collapses"*. Study § 4 + § 6 row 19; prototype screen 4.
 *
 * There is no DOM in this runner, so — as `lib/one-open.test.ts` does — the
 * DECISION runs for real (two folds and a dropdown inside one, through
 * `joinOneOpen`, exactly as `useOneOpen` drives it) and the WIRING is pinned
 * against the source, comments stripped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { joinOneOpen } from '@/lib/one-open';
import { EVENT_DETAILS_SECTIONS } from '@/lib/event-details-sheet';
import { RECORD_GROUPS, foldSummary } from '@/lib/event-details-record';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE = read('app/dashboard/[eventId]/details/page.tsx');
const FOLD = read('app/dashboard/[eventId]/details/_components/record-fold.tsx');
const SHEET = read('app/dashboard/[eventId]/details/_components/record-field-sheet.tsx');

/** The page's four folds, in order, with the JSX each holds. */
function folds(): Array<{ group: string; body: string }> {
  const at = [...PAGE.matchAll(/<RecordFold group="([^"]+)"/g)];
  return at.map((m, i) => ({
    group: m[1]!,
    body: PAGE.slice(m.index!, i + 1 < at.length ? at[i + 1]!.index! : PAGE.indexOf('data-section="put-away"')),
  }));
}

test('the record is exactly five groups, in the owner’s order', () => {
  // The fifth, Event access, is owner 2026-10-07 (`event-access-is-its-own-fold.test.ts`).
  assert.deepEqual(
    RECORD_GROUPS.map((g) => g.title),
    ['How it looks', 'How it works', 'Your event', 'Guests & money', 'Event access'],
  );
  assert.deepEqual(
    folds().map((f) => f.group),
    RECORD_GROUPS.map((g) => g.key),
    'the page does not draw the five groups, once each, in order',
  );
  for (const g of RECORD_GROUPS) {
    assert.match(PAGE, new RegExp(`<RecordFold group="${g.key}" title=\\{groupTitle\\('${g.key}'\\)\\} summary=\\{summary(?:\\.${g.key.replace('-', '')}|\\['${g.key}'\\])\\}`), `${g.key} has no one-line summary`);
  }
});

test('every section sits in its own group’s fold — none left outside', () => {
  const byGroup = new Map(folds().map((f) => [f.group, f.body]));
  let checked = 0;
  for (const s of EVENT_DETAILS_SECTIONS) {
    if (s.group === null) continue;
    checked += 1;
    const body = byGroup.get(s.group) ?? '';
    const marker = s.key === 'access' ? '<PeopleWithAccess' : `<Section k="${s.key}"`;
    assert.ok(body.includes(marker), `section "${s.key}" is not inside the "${s.group}" fold`);
  }
  assert.equal(checked, EVENT_DETAILS_SECTIONS.length - 1, 'a section has no group');
  // Put this away stays last and outside the folds.
  assert.ok(PAGE.lastIndexOf('<RecordFold') < PAGE.indexOf('data-section="put-away"'));
});

test('the Finish-your-Event-Hub card sits on top, above the folds', () => {
  const card = PAGE.indexOf('data-record-finish=""');
  assert.ok(card > 0, 'the Finish card is gone');
  assert.ok(card < PAGE.indexOf('<RecordFold'), 'the Finish card is not above the four groups');
  assert.match(PAGE, /readHomeGuide\(\{ eventId, memberType: 'couple' \}\)/, 'the card does not read Home’s own guided-flow position');
});

test('phone: a fold is one line with its summary, its body hidden until opened; desktop: always open', () => {
  // The fold's line is phone-only; the heading is desktop-only.
  assert.match(FOLD, /aria-expanded=\{open\}[\s\S]{0,200}?className="[^"]*\blg:hidden\b/);
  assert.match(FOLD, /data-record-summary=""/);
  assert.match(FOLD, /<h2 className="hidden [^"]*\blg:block\b/);
  // Folded = hidden on the phone ONLY.
  assert.match(FOLD, /\$\{open \? '' : 'max-lg:hidden'\}/);
  assert.doesNotMatch(FOLD, /\$\{open \? '' : 'hidden'\}/, 'a folded group is hidden on a desktop too');
  // A fold starts open only when its own row's field is open (nothing else).
  assert.match(FOLD, /useState\(fieldHere\)/);
});

test('one open at a time — the folds join the app’s one mechanism, and a field’s dropdowns are its fold’s children', () => {
  assert.match(FOLD, /const id = useOneOpen\(open, setOpen\);/, 'the fold keeps a private open state');
  assert.match(FOLD, /<OneOpenScope id=\{id\}>\{children\}<\/OneOpenScope>/, 'a dropdown inside a fold would close it');
  // The field arrives in another tree (the @field slot) — it still names its fold as its parent.
  assert.match(SHEET, /const foldId = recordFoldId\(group\);/);
  assert.match(SHEET, /<OneOpenScope id=\{foldId\}>\{children\}<\/OneOpenScope>/);
  // Folding the group whose field is open closes that field on the phone (a navigation — no write).
  assert.match(FOLD, /if \(!next && fieldHere && onPhone\(\)\) router\.replace\(recordHref, \{ scroll: false \}\);/);
});

test('the decision itself: opening one fold closes the other; a dropdown inside a fold does not close it', () => {
  const state: Record<string, boolean> = { looks: false, works: false, pick: false };
  const leave: Record<string, () => void> = {};
  const open = (id: string, chain: string[] = []) => {
    state[id] = true;
    leave[id] = joinOneOpen(id, chain, () => {
      state[id] = false;
      leave[id]?.();
    }, true);
  };
  open('looks');
  assert.deepEqual(state, { looks: true, works: false, pick: false });
  open('works');
  assert.deepEqual(state, { looks: false, works: true, pick: false }, 'two groups open at once');
  open('pick', ['works']);
  assert.deepEqual(state, { looks: false, works: true, pick: true }, 'a dropdown inside the open group folded it');
  open('looks');
  assert.deepEqual(state, { looks: true, works: false, pick: false }, 'opening another group left the first (or its dropdown) open');
  for (const id of Object.keys(leave)) leave[id]?.();
});

test('a summary is the group’s own values — never empty, never invented', () => {
  assert.equal(foldSummary(['Classic', null, ' ', 'Cormorant']), 'Classic · Cormorant');
  assert.equal(foldSummary([null, '']), 'Not set yet');
  assert.equal(foldSummary(['a', 'b', 'c', 'd', 'e']), 'a · b · c · d');
});
