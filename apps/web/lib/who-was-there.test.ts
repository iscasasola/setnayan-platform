/**
 * WHO WAS THERE — the consent gate, and what is deliberately withheld.
 *
 * Publishing somebody's name on a public web page is a disclosure they did not
 * make by being on a guest list. The only people on this band are those who
 * ACCEPTED a named role — an affirmative act, recorded with a timestamp, in
 * answer to an invitation that named the role.
 *
 * Source-level: the module imports `server-only` and cannot load in a unit
 * runtime, so these read the code — the same idiom as the other guards on this
 * surface. The behaviour under a real database is covered by the db suite.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_SPONSOR_GUEST_COLUMNS, acceptedTheNamedRole } from './sponsor-guests';

const src = () => readFileSync(join(process.cwd(), 'lib', 'who-was-there.ts'), 'utf8');
/** A guard must read the code, never the comment explaining the rule. */
const code = () => src().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('🔒 ONLY people who ACCEPTED THE NAMED ROLE are published', () => {
  // Since sponsors are guests (owner, brief Add 41), the band reads the guest list's sponsors through the one helper,
  // in its PUBLIC mode, and keeps only those who were asked to stand in the role AND answered yes themselves.
  assert.match(
    code(),
    /querySponsorGuests\(admin, ids, \{ publicOnly: true \}\)/,
    'The band must read the sponsors through querySponsorGuests in its public mode (no contact details).',
  );
  assert.match(
    code(),
    /\.filter\(acceptedTheNamedRole\)/,
    'The consent gate is gone. Everyone the couple typed into a sponsor list — ' +
      'including people who never answered, and people who said no — would be ' +
      'published on a public page.',
  );
});

test('🔒 the gate itself: asked for the role, AND their own yes — an event RSVP or a host’s mark is not consent', () => {
  const asked = '2026-11-20T00:00:00Z';
  assert.equal(acceptedTheNamedRole({ invitation_status: 'accepted', invitation_sent_at: asked, reply_set_by: 'guest' }), true);
  assert.equal(acceptedTheNamedRole({ invitation_status: 'accepted', invitation_sent_at: null, reply_set_by: 'guest' }), false, 'never asked: an RSVP to the event');
  assert.equal(acceptedTheNamedRole({ invitation_status: 'accepted', invitation_sent_at: asked, reply_set_by: 'host' }), false, 'a host’s mark');
  assert.equal(acceptedTheNamedRole({ invitation_status: 'invited', invitation_sent_at: asked, reply_set_by: null }), false);
  assert.equal(acceptedTheNamedRole({ invitation_status: 'declined', invitation_sent_at: asked, reply_set_by: 'guest' }), false);
  // …and the public mode reads no contact details at all.
  for (const field of ['email', 'mobile', 'notes']) {
    assert.doesNotMatch(PUBLIC_SPONSOR_GUEST_COLUMNS, new RegExp(`\\b${field}\\b`), `the public read selects ${field}`);
  }
});

test('🔴 an invitation is a QUESTION — "invited" must never count as a yes', () => {
  const body = code();
  for (const status of ['invited', 'pending', 'declined']) {
    assert.equal(
      count(body, new RegExp(`'${status}'`, 'g')),
      0,
      `The band admits '${status}'. Publishing that answer before it is given ` +
        'answers it for them — and naming somebody who declined is worse than ' +
        'not naming them at all.',
    );
  }
});

test('🔒 contact details and private notes are never selected', () => {
  const body = code();
  for (const field of ['email', 'phone', 'relationship_note', 'decline_note']) {
    assert.equal(
      count(body, new RegExp(`\\b${field}\\b`, 'g')),
      0,
      `The public band reads ${field}. An invitation card shows a name and a ` +
        'role; it does not show somebody’s phone number or why they said no.',
    );
  }
});

test('ordinary guests are not on this band at all', () => {
  assert.equal(
    count(code(), /from\('guests'\)/g),
    0,
    'The band reads the guests table. Nobody in it agreed to be named in ' +
      'public — they were typed into a list by somebody else.',
  );
});

test('a refused read names nobody', () => {
  const body = code();
  assert.match(body, /if \(error\)[\s\S]{0,220}return \[\]/, 'a failed read must return nobody');
  assert.match(src(), /console\.error\('\[who-was-there\]/, 'and must say so somewhere');
});

test('the Filipino roles are the ones that exist, not invented ones', () => {
  const body = code();
  for (const tier of ['principal', 'cord', 'veil', 'coin', 'candle']) {
    assert.match(body, new RegExp(`\\b${tier}\\b`), `the ${tier} tier is missing`);
  }
  assert.match(body, /Ninong/);
  assert.match(body, /Ninang/);
});
