/**
 * 👈 THE SUPPLIER PAGES' ROWS DELETE BY THEIR SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST
 * ROW — NO VISIBLE ✕ ON ROWS") — each swipe reaches the SAME write its ✕ / Remove used to, with Undo:
 *
 *   · a candidate on "Your team"        → `removeBuildPick` (vendor-scoped), `deleteWithUndo`
 *   · a saved plan (Compare)            → the SAME "Delete this plan?" ask, then `deleteBudgetBuild` with Undo
 *   · your note in a working folder     → `deleteWorkingNoteAction` (event_id · vendor_id · note_id), Undo
 *   · a line on a booked package        → `removeItemFromPackage` (event_id · booking_id · item_id), Undo
 *
 * SABOTAGE (seen RED, then restored, 2026-11-03): the confirm dropped from the plan's delete → test 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));

test('1 · a candidate on Your team: no ✕ — the row is the swipe, the same removeBuildPick, with Undo', () => {
  const locked = read('_components/build-locked.tsx');
  assert.doesNotMatch(locked, /TeamRemoveCandidate/);
  assert.equal((locked.match(/<TeamCandidateSwipe\b/g) ?? []).length, 2, 'the ready rows and the blocked rows both swipe');
  const ctl = read('_components/team-controls.tsx');
  assert.match(ctl, /commit: \(\) => removeBuildPick\(\{ eventId, planGroupId: groupId, vendorId \}\)/);
  assert.match(ctl, /<SwipeToDelete\b[\s\S]*?label=\{`Remove \$\{vendorName\} from your build`\}/);
});

test('2 · a saved plan: the row is the swipe — it asks the same question, then deletes with Undo', () => {
  const cmp = read('_components/build-compare.tsx');
  assert.match(cmp, /<SwipeToDelete\s+key=\{b\.build_id\}\s+as="li"\s+label=\{`Delete \$\{title\}`\}[\s\S]*?onDelete=\{\(close\) => void onDelete\(b\.build_id, title, close\)\}/);
  const del = cmp.slice(cmp.indexOf('async function onDelete('));
  assert.match(del, /await confirm\(\{[\s\S]*?title: 'Delete this plan\?'[\s\S]*?if \(!ok\) \{\s*close\?\.\(\);\s*return;\s*\}\s*deleteWithUndo\(\{[\s\S]*?commit: \(\) => deleteBudgetBuild\(\{ eventId, buildId \}\)/);
});

test('3 · your note: no trash — the note is the swipe, the same deleteWorkingNoteAction, with Undo', () => {
  const notes = read('[vendorId]/workspace/_components/working-folder-notes.tsx');
  assert.doesNotMatch(notes, /aria-label="Remove your note"/);
  assert.match(notes, /canDeleteWorkingNote\(user\.id, n\) \? \(\s*<WorkingNoteSwipe\b/);
  const swipe = read('[vendorId]/workspace/_components/working-note-swipe.tsx');
  assert.match(swipe, /fd\.set\('event_id', eventId\);\s*fd\.set\('vendor_id', vendorId\);\s*fd\.set\('note_id', noteId\);\s*return deleteWorkingNoteAction\(fd\);/);
});

test('4 · a line on a booked package: no Remove button — the row is the swipe, the same removeItemFromPackage, with Undo', () => {
  const page = read('packages/[bookingId]/page.tsx');
  assert.doesNotMatch(page, /<form action=\{removeItemFromPackage\}>/);
  assert.match(page, /isLocked \? \(\s*<PackageItemSwipe\b/);
  const swipe = read('packages/[bookingId]/_components/package-item-swipe.tsx');
  assert.match(swipe, /fd\.set\('event_id', eventId\);\s*fd\.set\('booking_id', bookingId\);\s*fd\.set\('item_id', itemId\);\s*return removeItemFromPackage\(fd\);/);
});
