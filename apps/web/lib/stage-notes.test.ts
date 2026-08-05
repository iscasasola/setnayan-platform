/**
 * The coordinator → emcee channel. Every test here is about the boundary: the
 * emcee reads notes addressed to them and gains NOTHING else on the event.
 *
 * The rejected alternative was giving the emcee event-member access, which
 * would have let a supplier read the couple's private schedule notes — the ones
 * that exist because they are not for saying out loud.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanStageNote, unreadCount, STAGE_NOTE_MAX } from './stage-notes';
import { pickEmceeRecipients, EMCEE_TILE } from './stage-notes-recipients';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const SQL = read('..', '..', '..', 'supabase', 'migrations', '20271111090000_coordinator_to_emcee_notes.sql');
const ACTIONS = read('..', 'app', 'vendor-dashboard', 'on-the-day', 'live', '[eventId]', '_components', 'stage-notes-actions.ts');

test('an empty or oversized note is refused before it is sent', () => {
  assert.equal(cleanStageNote('   '), null);
  assert.equal(cleanStageNote(''), null);
  assert.equal(cleanStageNote('x'.repeat(STAGE_NOTE_MAX + 1)), null);
  assert.equal(cleanStageNote(42), null);
  assert.equal(cleanStageNote('  Hold the toast.  '), 'Hold the toast.');
});

test('the cleaner returns the cleaned value, not a boolean', () => {
  // So a caller cannot validate one string and then send a different one.
  assert.equal(cleanStageNote(' trimmed '), 'trimmed');
});

test('only a supplier holding the host tile is offered as a recipient', () => {
  const picked = pickEmceeRecipients([
    { vendorProfileId: 'host-1', name: 'Kuya Mike', categories: [EMCEE_TILE], serviceCategories: null },
    { vendorProfileId: 'florist', name: 'Bloom', categories: ['florist'], serviceCategories: null },
    { vendorProfileId: null, name: 'Unlinked', categories: [EMCEE_TILE], serviceCategories: null },
  ]);
  assert.deepEqual(picked.map((p) => p.vendorProfileId), ['host-1']);
});

test('a supplier booked for two jobs still counts as the host', () => {
  // The band AND the emcee is a real booking shape, and reading only the
  // summary column is what made a desk unreachable before.
  const picked = pickEmceeRecipients([
    { vendorProfileId: 'band', name: 'The Band', categories: ['live_band'], serviceCategories: [EMCEE_TILE] },
  ]);
  assert.deepEqual(picked.map((p) => p.vendorProfileId), ['band']);
});

test('the same supplier is never offered twice', () => {
  const picked = pickEmceeRecipients([
    { vendorProfileId: 'h', name: 'Host', categories: [EMCEE_TILE], serviceCategories: null },
    { vendorProfileId: 'h', name: 'Host', categories: [EMCEE_TILE], serviceCategories: null },
  ]);
  assert.equal(picked.length, 1);
});

test('unread counts only what has not been seen', () => {
  const n = (id: string, readAt: string | null) => ({ noteId: id, body: 'x', createdAt: '', readAt });
  assert.equal(unreadCount([n('a', null), n('b', '2026-01-01'), n('c', null)]), 2);
  assert.equal(unreadCount([]), 0);
});

// ── The boundary, in SQL ────────────────────────────────────────────────────

test('the recipient is NOT NULL — a note with no audience rule cannot exist', () => {
  assert.match(SQL, /recipient_vendor_profile_id\s+uuid NOT NULL/);
});

test('the read policy names the recipient, not the event', () => {
  // If this ever became "anyone booked on the event", every supplier would read
  // the host's instructions. That is the whole boundary.
  // ⚠ Slice from CREATE POLICY, not from the name's first occurrence — that is
  // the DROP line above it, and slicing to its ';' reads an empty statement.
  // The first version of this test did exactly that and asserted on nothing.
  const policy = SQL.slice(SQL.indexOf('CREATE POLICY event_stage_notes_recipient_read'));
  const using = policy.slice(policy.indexOf('USING'), policy.indexOf(';'));
  assert.match(using, /recipient_vendor_profile_id IN \(SELECT public\.current_vendor_profile_ids\(\)\)/);
  assert.ok(
    !/current_vendor_booked_event_ids/.test(using),
    'must not widen to every booked supplier on the event',
  );
});

test('only the recipient can stamp a note as seen', () => {
  // A receipt the sender can forge is not a receipt.
  const policy = SQL.slice(SQL.indexOf('CREATE POLICY event_stage_notes_recipient_ack'));
  const clause = policy.slice(0, policy.indexOf(';'));
  assert.match(clause, /FOR UPDATE/);
  assert.match(clause, /recipient_vendor_profile_id IN \(SELECT public\.current_vendor_profile_ids\(\)\)/);
});

test('the new table does not arrive with blanket grants', () => {
  // New public tables ship OPEN in this project unless revoked.
  assert.match(SQL, /REVOKE ALL ON public\.event_stage_notes FROM anon, authenticated/);
  assert.match(SQL, /ENABLE ROW LEVEL SECURITY/);
  assert.ok(!/GRANT ALL/.test(SQL), 'no blanket grant');
});

test('the author is stamped from the session, never from the form', () => {
  const code = strip(ACTIONS);
  assert.match(code, /author_user_id: user\.id/);
  assert.ok(
    !/author_user_id.*formData\.get/.test(code),
    'a note must not be filable under someone else’s name',
  );
});

test('both writes use the caller’s own client', () => {
  const code = strip(ACTIONS);
  assert.ok(!/createAdminClient/.test(code), 'service-role would replace the policies');
});
