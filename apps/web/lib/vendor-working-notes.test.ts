/**
 * Working-folder note access predicate invariants (Node built-in test runner,
 * run via tsx — `pnpm test:unit`).
 *
 * The one that matters most: a COUPLE viewer must NEVER read (or be offered)
 * a 'coordinator_private' note on their own event — the deliberate inversion
 * of the usual "couple reads everything on their event" Pattern B direction.
 * These helpers mirror the event_vendor_working_notes RLS policies (migration
 * 20270825279091); RLS is the real wall, this suite pins the TS mirror.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  canDeleteWorkingNote,
  canReadWorkingNote,
  canWriteWorkingNote,
  isCoordinatorVendorNotesEnabled,
  isWorkingNoteVisibility,
  visibleWorkingNotes,
  workingNoteAuthorRole,
  type WorkingNoteViewer,
  type WorkingNoteVisibility,
} from './vendor-working-notes';

const COORDINATOR: WorkingNoteViewer = { isCouple: false, isCoordinator: true };
const COUPLE: WorkingNoteViewer = { isCouple: true, isCoordinator: false };
const BOTH: WorkingNoteViewer = { isCouple: true, isCoordinator: true };
const NEITHER: WorkingNoteViewer = { isCouple: false, isCoordinator: false };

// ---------------------------------------------------------------------------
// canReadWorkingNote — the SELECT truth table
// ---------------------------------------------------------------------------

test('coordinator reads both private and shared notes', () => {
  assert.equal(canReadWorkingNote(COORDINATOR, 'coordinator_private'), true);
  assert.equal(canReadWorkingNote(COORDINATOR, 'shared'), true);
});

test('couple reads shared notes ONLY — coordinator_private is walled off', () => {
  assert.equal(canReadWorkingNote(COUPLE, 'shared'), true);
  // THE feature: private-from-the-couple on the couple's own event.
  assert.equal(canReadWorkingNote(COUPLE, 'coordinator_private'), false);
});

test('a viewer who is neither couple nor coordinator reads nothing', () => {
  assert.equal(canReadWorkingNote(NEITHER, 'shared'), false);
  assert.equal(canReadWorkingNote(NEITHER, 'coordinator_private'), false);
});

test('couple+coordinator dual role gets the coordinator grant (permissive OR)', () => {
  assert.equal(canReadWorkingNote(BOTH, 'coordinator_private'), true);
  assert.equal(canReadWorkingNote(BOTH, 'shared'), true);
});

// ---------------------------------------------------------------------------
// canWriteWorkingNote + workingNoteAuthorRole — the INSERT truth table
// ---------------------------------------------------------------------------

test('coordinator may write at either visibility', () => {
  assert.equal(canWriteWorkingNote(COORDINATOR, 'coordinator_private'), true);
  assert.equal(canWriteWorkingNote(COORDINATOR, 'shared'), true);
});

test('couple may write shared only — never a coordinator_private note', () => {
  assert.equal(canWriteWorkingNote(COUPLE, 'shared'), true);
  assert.equal(canWriteWorkingNote(COUPLE, 'coordinator_private'), false);
});

test('non-members may write nothing', () => {
  assert.equal(canWriteWorkingNote(NEITHER, 'shared'), false);
  assert.equal(canWriteWorkingNote(NEITHER, 'coordinator_private'), false);
});

test('author_role stamps coordinator > couple > null', () => {
  assert.equal(workingNoteAuthorRole(COORDINATOR), 'coordinator');
  assert.equal(workingNoteAuthorRole(COUPLE), 'couple');
  assert.equal(workingNoteAuthorRole(BOTH), 'coordinator');
  assert.equal(workingNoteAuthorRole(NEITHER), null);
});

// ---------------------------------------------------------------------------
// visibleWorkingNotes — the render filter
// ---------------------------------------------------------------------------

const NOTES: Array<{ visibility: WorkingNoteVisibility; body: string }> = [
  { visibility: 'coordinator_private', body: 'caterer padding the crew count' },
  { visibility: 'shared', body: 'final menu confirmed for tasting' },
  { visibility: 'coordinator_private', body: 'push back on ingress time' },
];

test('couple viewer sees only the shared subset', () => {
  const seen = visibleWorkingNotes(COUPLE, NOTES);
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.visibility, 'shared');
});

test('coordinator viewer sees every note', () => {
  assert.equal(visibleWorkingNotes(COORDINATOR, NOTES).length, 3);
});

test('non-member viewer sees nothing', () => {
  assert.equal(visibleWorkingNotes(NEITHER, NOTES).length, 0);
});

// ---------------------------------------------------------------------------
// canDeleteWorkingNote — author-only removal
// ---------------------------------------------------------------------------

test('only the author may delete their own note', () => {
  const note = { author_user_id: 'user-a' };
  assert.equal(canDeleteWorkingNote('user-a', note), true);
  assert.equal(canDeleteWorkingNote('user-b', note), false);
  assert.equal(canDeleteWorkingNote('', note), false);
});

// ---------------------------------------------------------------------------
// isWorkingNoteVisibility — form input validation
// ---------------------------------------------------------------------------

test('visibility validator accepts only the two enum values', () => {
  assert.equal(isWorkingNoteVisibility('coordinator_private'), true);
  assert.equal(isWorkingNoteVisibility('shared'), true);
  assert.equal(isWorkingNoteVisibility('public'), false);
  assert.equal(isWorkingNoteVisibility(''), false);
  assert.equal(isWorkingNoteVisibility(null), false);
  assert.equal(isWorkingNoteVisibility(42), false);
});

// ---------------------------------------------------------------------------
// Feature flag — default OFF; only explicit true-ish values enable
// ---------------------------------------------------------------------------

const FLAG = 'NEXT_PUBLIC_COORDINATOR_VENDOR_NOTES_ENABLED';
const originalFlag = process.env[FLAG];

beforeEach(() => {
  delete process.env[FLAG];
});
afterEach(() => {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
});

test('flag absent/off ⇒ disabled (today’s behavior exactly)', () => {
  assert.equal(isCoordinatorVendorNotesEnabled(), false);
  process.env[FLAG] = 'false';
  assert.equal(isCoordinatorVendorNotesEnabled(), false);
  process.env[FLAG] = '0';
  assert.equal(isCoordinatorVendorNotesEnabled(), false);
});

test('flag true/1/TRUE ⇒ enabled', () => {
  process.env[FLAG] = 'true';
  assert.equal(isCoordinatorVendorNotesEnabled(), true);
  process.env[FLAG] = '1';
  assert.equal(isCoordinatorVendorNotesEnabled(), true);
  process.env[FLAG] = 'TRUE';
  assert.equal(isCoordinatorVendorNotesEnabled(), true);
});
