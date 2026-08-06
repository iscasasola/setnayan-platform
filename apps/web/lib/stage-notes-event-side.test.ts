/**
 * "TELL THE HOST" ON THE EVENT SIDE — the coordinator who is the couple's aunt.
 *
 * The coordinator → emcee channel shipped with its send box inside the SUPPLIER
 * floor console. The person it was built for is very often not a supplier at
 * all: she works from the couple's own dashboard. These tests hold the two
 * claims that matter about closing that gap.
 *
 *   1. NOTHING WAS WIDENED. The shipped INSERT policy already admits the event
 *      side. If someone later "fixes" this feature by loosening a policy, the
 *      SQL assertions below are the ones that should be argued with first.
 *   2. THE SCREEN AND THE POLICY AGREE. A send box shown to someone the policy
 *      refuses is a button that fails on tap, in the middle of a reception.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseNoteFlash } from '../app/dashboard/[eventId]/schedule/_components/note-flash';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const SCHEDULE = ['..', 'app', 'dashboard', '[eventId]', 'schedule'];
const SQL = read(
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20271111090000_coordinator_to_emcee_notes.sql',
);
const ACTION = read(...SCHEDULE, 'stage-note-actions.ts');
const COMPOSE = read(...SCHEDULE, '_components', 'tell-the-host.tsx');
const PAGE = read(...SCHEDULE, 'page.tsx');

// ── 1 · The permission was already there ────────────────────────────────────

test('the shipped insert policy already admits the couple and their schedule delegate', () => {
  // This is the whole justification for the change being a SCREEN and not a
  // migration. If this ever stops holding, the feature must be re-argued with
  // the owner — who may message whom is his call, not a build decision.
  const policy = SQL.slice(SQL.indexOf('CREATE POLICY event_stage_notes_event_insert'));
  const check = policy.slice(policy.indexOf('WITH CHECK'), policy.indexOf(';'));
  assert.match(check, /event_id IN \(SELECT public\.current_event_ids\(\)\)/);
  assert.match(check, /public\.moderator_area_level\(event_id, 'schedule'\) = 'edit'/);
});

test('a note still cannot be filed under someone else’s name', () => {
  const policy = SQL.slice(SQL.indexOf('CREATE POLICY event_stage_notes_event_insert'));
  const check = policy.slice(policy.indexOf('WITH CHECK'), policy.indexOf(';'));
  assert.match(check, /author_user_id = auth\.uid\(\)/);
});

test('the event-side surface ships no SQL of its own', () => {
  // A screen that needed a new grant to work would be a permission decision
  // wearing a UI costume.
  const code = strip(ACTION) + strip(COMPOSE);
  for (const forbidden of ['CREATE POLICY', 'GRANT ', 'ALTER TABLE', 'CREATE TABLE']) {
    assert.ok(!code.includes(forbidden), `must not ship ${forbidden}`);
  }
});

// ── 2 · The write is the same write ─────────────────────────────────────────

test('the author is stamped from the session, never from the form', () => {
  const code = strip(ACTION);
  assert.match(code, /author_user_id: user\.id/);
  assert.ok(
    !/author_user_id[\s\S]{0,40}formData\.get/.test(code),
    'a note must not be filable under someone else’s name',
  );
});

test('the write uses the caller’s own client', () => {
  // Service-role would substitute our idea of who may send for the policy's.
  assert.ok(!/createAdminClient/.test(strip(ACTION)), 'service-role would replace the policies');
});

test('the shared cleaner is reused, not a second copy of the length rule', () => {
  const code = strip(ACTION);
  assert.match(code, /cleanStageNote/);
  assert.ok(
    !/\b240\b/.test(code),
    'the length lives in lib/stage-notes.ts and the column CHECK — never re-typed here',
  );
});

test('the event side never lands the sender in the supplier console', () => {
  // The vendor layout bounces anyone without a vendor profile to /dashboard.
  // Reusing the supplier action verbatim would throw the couple's coordinator
  // out of the page she is working from on every send.
  const code = strip(ACTION);
  assert.ok(!/vendor-dashboard/.test(code), 'a non-vendor sender must stay on their own page');
  assert.match(code, /\/dashboard\/\$\{eventId\}\/schedule/);
});

test('a refused insert is reported, not swallowed', () => {
  // A note the sender believes landed is the dangerous outcome.
  assert.match(strip(ACTION), /if \(error\) backToSchedule\(eventId, 'error'\)/);
});

// ── 3 · The screen agrees with the policy ───────────────────────────────────

test('the send box is gated on the same value as the run-of-show advance', () => {
  // `canAdvanceRunOfShow` is derived from an event_members row OR a delegate
  // resolving schedule:'edit' — exactly the two branches of the insert policy's
  // event side. Any other predicate here is a button that 42501s on tap.
  assert.match(strip(PAGE), /canSend=\{canAdvanceRunOfShow\}/);
  const derivation = PAGE.slice(PAGE.indexOf('const canAdvanceRunOfShow'));
  assert.match(derivation.slice(0, 400), /resolveAreaLevel\([\s\S]*?'schedule',\s*\)\s*===\s*'edit'/);
});

test('no host booked means no send box at all', () => {
  // A box addressed to nobody is a promise the product cannot keep.
  assert.match(strip(COMPOSE), /hosts\.length === 0\) return null/);
});

test('the sent list is hidden when empty, because empty is ambiguous', () => {
  // fetchStageNotes returns [] for a failed read as well as for an empty
  // channel. Rendering "you have sent nothing" over an error would be a lie.
  assert.match(strip(COMPOSE), /notes\.length > 0 \? <SentList/);
});

// ── 4 · The banner cannot be forged from the address bar ────────────────────

test('only the two outcomes we write are shown as a banner', () => {
  assert.equal(parseNoteFlash('sent'), 'sent');
  assert.equal(parseNoteFlash('error'), 'error');
  assert.equal(parseNoteFlash('Sent'), null);
  assert.equal(parseNoteFlash('delivered'), null);
  assert.equal(parseNoteFlash(''), null);
  assert.equal(parseNoteFlash(undefined), null);
  assert.equal(parseNoteFlash(['sent']), null);
});
