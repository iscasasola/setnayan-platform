/**
 * GUARD — the eight gates that keep a supplier out of a couple's gallery.
 *
 * Owner, 2026-08-26, ruling on supplier access to guest media: *"the host will
 * allow access. they only get shots from the sponsored papic challenge."*
 *
 * 🚨 THIS RUNS ON THE SERVICE ROLE, SO THE APP-SIDE GATE IS THE WHOLE FENCE.
 * RLS is a floor, not a scope — there is no policy underneath to catch a
 * dropped clause. Losing any ONE of these widens the read from *"the photos
 * guests took for your challenge"* to *"the couple's gallery"*, silently, with
 * no error anywhere. That is precisely the shape that has cost this project
 * three times: an admin able to post into any private samahan, a shop reading
 * every other shop's correction requests, and a coordinator served the whole
 * album.
 *
 * ⚠ A SOURCE GUARD, DELIBERATELY. A behaviour test proves the query returns
 * nothing for the wrong vendor **on the fixtures it was given**; this proves
 * every clause is still written down. Both are worth having, and this one is
 * the one that fails the moment a clause is deleted, regardless of fixtures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(LIB, 'vendor-sponsored-shots.ts'), 'utf8');

/** The query chain only — never the docblock, which NAMES every gate it guards. */
function queryChain(): string {
  const start = SRC.indexOf("await admin");
  const end = SRC.indexOf('if (error)', start);
  assert.ok(start > 0 && end > start, 'the query was restructured beyond recognition');
  return SRC.slice(start, end);
}

test('there is still a query here — or every rule below is vacuous', () => {
  const q = queryChain();
  assert.ok(q.includes("from('papic_mission_completions')"), 'the reader no longer starts from completions');
  assert.ok(q.split('.eq(').length - 1 >= 6, 'far fewer filters than the eight gates this needs');
});

const GATES: Array<[string, string, string]> = [
  ['this event only', ".eq('event_id', eventId)", 'a supplier could read their challenge on ANOTHER of their bookings'],
  ['their own challenge', ".eq('papic_missions.vendor_id', vendorProfileId)", "a supplier could read ANOTHER supplier's sponsored shots"],
  ['a supplier challenge', ".eq('papic_missions.source', 'vendor')", "a supplier could read the COUPLE's own challenges"],
  ['the host said yes', ".eq('papic_missions.approved', true)", 'a supplier could read shots from a challenge the host never approved — the access grant IS this clause'],
  ['still running', ".eq('papic_missions.is_active', true)", 'a retired challenge would keep feeding'],
  ['the guest said yes', ".eq('consent_to_share', true)", 'a supplier would receive photographs the guest declined to share'],
  ['not taken down', ".is('papic_guest_captures.hidden_at', null)", "the couple's own take-down would be ignored"],
  ['screened clean', ".eq('papic_guest_captures.moderation_state', 'clean')", 'a photo the safety screen has never looked at could reach a supplier'],
];

for (const [name, clause, harm] of GATES) {
  test(`🚨 gate: ${name}`, () => {
    assert.ok(queryChain().includes(clause), `${clause} is gone — ${harm}`);
  });
}

test('🚨 the safety filter is an ALLOWLIST, never a deny-list', () => {
  const q = queryChain();
  assert.ok(
    !/\.neq\('papic_guest_captures\.moderation_state'/.test(q),
    'the screen check became a deny-list. Two states in that column (consent_withheld, faceblock_withheld) ' +
      'are filtered on elsewhere and WRITTEN BY NOTHING — a deny-list lets every state nobody thought of through, ' +
      'including `unscreened`.',
  );
});

test('🚨 a failed read is EMPTY and says so — never a partial gallery', () => {
  assert.ok(
    /if \(error\) return \{ ok: false, shots: \[\] \};/.test(SRC),
    'a failed read no longer returns an empty, flagged result. Supabase resolves with { error } rather than ' +
      'throwing, so without this a partial list of somebody else\'s wedding photographs is what a caller gets.',
  );
});
