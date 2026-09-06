/**
 * category-archive.test.ts — removing a category archives its conversations,
 * and restoring it brings back EXACTLY the ones it archived.
 *
 * The case that matters most is the third one: a thread the couple withdrew
 * themselves must survive an unrelated category restore untouched. Getting
 * that wrong silently overwrites their decision with somebody else's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  archiveStamp,
  threadsToArchive,
  threadsToRestore,
} from './category-archive';

const STAMP = '2026-09-06T10:00:00.000Z';
const EARLIER = '2026-08-01T09:00:00.000Z';

const vendors = [
  { marketplace_vendor_id: 'v1' },
  { marketplace_vendor_id: 'v2' },
  { marketplace_vendor_id: null }, // an off-platform pick the couple typed in
];

test('archives the active threads of vendors in this category', () => {
  const threads = [
    { thread_id: 't1', vendor_profile_id: 'v1', archived_at: null },
    { thread_id: 't2', vendor_profile_id: 'v2', archived_at: null },
  ];
  assert.deepEqual(threadsToArchive({ vendors, threads }), ['t1', 't2']);
});

test('leaves a thread whose vendor is in ANOTHER category alone', () => {
  const threads = [
    { thread_id: 't1', vendor_profile_id: 'v1', archived_at: null },
    { thread_id: 'other', vendor_profile_id: 'v99', archived_at: null },
  ];
  assert.deepEqual(threadsToArchive({ vendors, threads }), ['t1']);
});

test('never re-stamps an ALREADY-archived thread — that timestamp belongs to whoever set it', () => {
  const threads = [
    { thread_id: 'withdrawn', vendor_profile_id: 'v1', archived_at: EARLIER },
    { thread_id: 't2', vendor_profile_id: 'v2', archived_at: null },
  ];
  assert.deepEqual(threadsToArchive({ vendors, threads }), ['t2']);
});

test('an off-platform pick has no profile id and no thread to archive', () => {
  const threads = [{ thread_id: 'ghost', vendor_profile_id: '', archived_at: null }];
  assert.deepEqual(threadsToArchive({ vendors, threads }), []);
});

test('restore brings back exactly this removal’s threads', () => {
  const threads = [
    { thread_id: 't1', vendor_profile_id: 'v1', archived_at: STAMP },
    { thread_id: 't2', vendor_profile_id: 'v2', archived_at: STAMP },
  ];
  assert.deepEqual(threadsToRestore({ threads, stamp: STAMP }), ['t1', 't2']);
});

test('🔑 a thread the couple withdrew THEMSELVES survives the restore untouched', () => {
  // The whole reason the stamp exists. A blanket un-archive would resurrect
  // "withdrawn" — a conversation they ended on purpose, weeks earlier.
  const threads = [
    { thread_id: 'withdrawn', vendor_profile_id: 'v1', archived_at: EARLIER },
    { thread_id: 't2', vendor_profile_id: 'v2', archived_at: STAMP },
  ];
  assert.deepEqual(threadsToRestore({ threads, stamp: STAMP }), ['t2']);
});

test('restore with no stamp restores nothing (a decision row that never archived)', () => {
  const threads = [{ thread_id: 't1', vendor_profile_id: 'v1', archived_at: STAMP }];
  assert.deepEqual(threadsToRestore({ threads, stamp: null }), []);
});

test('an active thread is never "restored" — it was never archived', () => {
  const threads = [{ thread_id: 't1', vendor_profile_id: 'v1', archived_at: null }];
  assert.deepEqual(threadsToRestore({ threads, stamp: STAMP }), []);
});

test('archiveStamp is a single ISO value — the same string both writes must carry', () => {
  const s = archiveStamp(new Date(STAMP));
  assert.equal(s, STAMP);
  // and it round-trips as the correlation key
  assert.deepEqual(
    threadsToRestore({
      threads: [{ thread_id: 't1', vendor_profile_id: 'v1', archived_at: s }],
      stamp: s,
    }),
    ['t1'],
  );
});

/* ── THE SOURCE HALF ─────────────────────────────────────────────────────────
   🔑 TESTING THE PRIMITIVE IS NOT TESTING THE CALLER. Every assertion above
   passes if `category-decision-actions.ts` stops calling this module entirely —
   which is exactly how a feature disappears. These read the action's source.

   The ORDER assertions are the load-bearing ones. Archiving before the decision
   row is written would, on a failed upsert, leave conversations stamped with a
   timestamp no row holds: invisible to the couple and unreachable by any
   restore. Deleting the decision row before reading `decided_at` destroys the
   only link back to them. Both are silent, and neither shows up as an error. */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = readFileSync(
  resolve(HERE, '../app/dashboard/[eventId]/vendors/category-decision-actions.ts'),
  'utf8',
);

test('source · the removal actually archives, and the restore actually un-archives', () => {
  assert.match(ACTIONS, /threadsToArchive\(/, 'exclude no longer archives its conversations');
  assert.match(ACTIONS, /threadsToRestore\(/, 'restore no longer brings them back');
  assert.match(ACTIONS, /archiveStamp\(/, 'the correlation stamp is no longer minted');
});

test('source · the decision row is written BEFORE any thread is archived', () => {
  const upsert = ACTIONS.indexOf("decision: 'excluded'");
  const archive = ACTIONS.indexOf('archiveCategoryThreads(supabase');
  assert.ok(upsert > -1 && archive > -1, 'the exclude path changed shape');
  assert.ok(
    upsert < archive,
    'threads would be archived before the decision row exists — on a failed ' +
      'upsert those conversations carry a stamp no row holds, and no restore ' +
      'can ever reach them',
  );
});

test('source · decided_at is read BEFORE the decision row is deleted', () => {
  const restoreIdx = ACTIONS.indexOf('export async function restoreTileToPlan');
  assert.ok(restoreIdx > -1, 'restoreTileToPlan is gone');
  const body = ACTIONS.slice(restoreIdx);
  const read = body.indexOf("select('decided_at')");
  const del = body.indexOf('.delete()');
  assert.ok(read > -1, 'the restore no longer reads the stamp at all');
  assert.ok(
    read < del,
    'the row is deleted before its stamp is read — the only link back to the ' +
      'archived conversations is destroyed first',
  );
});

test('source · the locked guard still runs before anything is archived', () => {
  // \b, not indexOf: a substring anchor happily passes a RENAMED symbol —
  // `REMOVE_BLOCKED_LOCKED_X` contains `REMOVE_BLOCKED_LOCKED`, so the first
  // draft of this guard stayed green through its own mutation.
  const m = /\bREMOVE_BLOCKED_LOCKED\b/.exec(ACTIONS);
  const guard = m ? m.index : -1;
  const archive = ACTIONS.indexOf('archiveCategoryThreads(supabase');
  assert.ok(guard > -1, 'the locked-category guard is gone');
  assert.ok(
    guard < archive,
    'a booked supplier’s conversation could be archived — the guard must ' +
      'refuse the removal before any thread is touched',
  );
});

test('source · it stamps archived_at and never deletes a thread', () => {
  assert.match(ACTIONS, /from\('chat_threads'\)[\s\S]{0,120}?\.update\(\{ archived_at/);
  const threadDelete = /from\('chat_threads'\)[\s\S]{0,80}?\.delete\(\)/.test(ACTIONS);
  assert.equal(threadDelete, false, 'a conversation must never be hard-deleted');
});

test('source · the couple is TOLD what removal does, somewhere that reaches them', () => {
  const bench = readFileSync(
    resolve(HERE, '../app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'),
    'utf8',
  );
  assert.match(bench, /REMOVE_FROM_PLAN_NOTE/, 'the removal note is not rendered at all');
  // aria-label OVERRIDES inner text, so the note must ride the label itself —
  // an sr-only span inside this button reaches nobody.
  assert.match(
    bench,
    /aria-label=\{`\$\{removeFromPlanButtonLabel\(t\.label\)\} — \$\{REMOVE_FROM_PLAN_NOTE\}`\}/,
    'the note no longer rides the aria-label — assistive tech would never hear it',
  );
  const copy = readFileSync(resolve(HERE, 'explore-info-copy.ts'), 'utf8');
  const note = /REMOVE_FROM_PLAN_NOTE\s*=\s*([\s\S]*?);/.exec(copy)?.[1] ?? '';
  // Assert the CLAIM, not the word — the note legitimately contains "deleted"
  // in the phrase "nothing is deleted", which is the whole point of it.
  assert.match(note, /nothing is deleted/i, 'the note no longer says nothing is destroyed');
  // Strip the sanctioned phrase FIRST, then look for a destruction claim in
  // what remains. A lookbehind here would be the third time this session a
  // guard's own pattern matched the thing it was written to permit.
  const claim = note.replace(/nothing is deleted/gi, '');
  assert.ok(
    !/(will be|are|is) (deleted|permanently removed)/i.test(claim),
    'the note claims a destruction the code does not perform — an earlier ' +
      'draft said the inquiries would be deleted, and excludeTileFromPlan ' +
      'deletes nothing at all',
  );
});
