/**
 * search-understands-words.test.ts — THE SEARCH READS WORDS, NOT ONLY NAMES
 * (Maker PR 4f · G18). Owner 2026-10-07: *"we can remove this? because if we
 * search attending it will already show all attending"*. Typing attending · no
 * reply · maybe · not coming · to invite · a role · a group · a side · a table
 * shows those guests; anything else is the ONE shipped matcher.
 *
 * Executed over a small roster. SABOTAGE (seen red): drop the "to invite" branch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GuestRow } from '@/lib/guests';
import { isToInvite, rosterSearchMatches, type RosterFacts } from '@/lib/guest-roster-view';

const g = (p: Partial<GuestRow>): GuestRow =>
  ({
    guest_id: 'x', first_name: 'A', last_name: 'B', role: 'guest', side: 'bride', rsvp_status: 'pending',
    group_category: 'friends', custom_tags: [], extra_roles: [], invitation_sent_at: '2026-09-01', entry_source: null,
    passed_away: false, ...p,
  }) as GuestRow;

const ROSTER: GuestRow[] = [
  g({ guest_id: 'maria', first_name: 'Maria', last_name: 'Santos', role: 'bride', rsvp_status: 'attending' }),
  g({ guest_id: 'ana', first_name: 'Ana', last_name: 'Cruz', rsvp_status: 'attending' }),
  g({ guest_id: 'ben', first_name: 'Ben', last_name: 'Reyes', side: 'groom', rsvp_status: 'pending' }),
  g({ guest_id: 'cita', first_name: 'Cita', last_name: 'Lim', rsvp_status: 'maybe' }),
  g({ guest_id: 'dan', first_name: 'Dan', last_name: 'Tan', side: 'groom', rsvp_status: 'declined' }),
  g({ guest_id: 'ella', first_name: 'Ella', last_name: 'Go', invitation_sent_at: null }),
  g({ guest_id: 'nong', first_name: 'Carlos', last_name: 'Dizon', role: 'principal_sponsor_ninong', side: 'groom', rsvp_status: 'attending' }),
];
const facts: RosterFacts = {
  hasSides: true,
  groupsOf: (id) => (id === 'ana' || id === 'ella' ? ['Choir'] : []),
  tableOf: (id) => (id === 'ben' ? 'Table 9' : null),
};
const hits = (q: string) => ROSTER.filter((x) => rosterSearchMatches(q, x, facts)).map((x) => x.guest_id).sort();

test('the reply words', () => {
  assert.deepEqual(hits('attending'), ['ana', 'maria', 'nong']);
  // Invited and silent — Ella has no invitation yet, so she is "to invite", not "no reply".
  assert.deepEqual(hits('no reply'), ['ben']);
  assert.deepEqual(hits('maybe'), ['cita']);
  assert.deepEqual(hits('not coming'), ['dan']);
});

test('"to invite" — nothing sent, not declined, never the couple', () => {
  assert.deepEqual(hits('to invite'), ['ella']);
  assert.deepEqual(ROSTER.filter(isToInvite).map((x) => x.guest_id), ['ella']);
});

test('a role, a group, a side, a table — and a name still works', () => {
  assert.deepEqual(hits('ninong'), ['nong']);
  assert.deepEqual(hits('choir'), ['ana', 'ella']);
  assert.deepEqual(hits('groom'), ['ben', 'dan', 'nong']);
  assert.deepEqual(hits('bride'), ['ana', 'cita', 'ella', 'maria']);
  assert.deepEqual(hits('table 9'), ['ben']);
  assert.deepEqual(hits('reyes'), ['ben']);
  assert.deepEqual(hits('zzz'), [], 'a non-word matches somebody — the "＋ Add" never appears');
});
