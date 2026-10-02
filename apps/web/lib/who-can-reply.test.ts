/**
 * Owner 2026-10-02 (d23): the Guests page asks no "Who can reply?" pop-up on the first
 * visit. The answer defaults to "Only people on my list" — read, never written — and is
 * changed in Event Details. This holds the page to that, and holds the default to the
 * words the owner chose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readWhoCanRsvp } from './rsvp-ask';
import { GUESTS_GET_IN_CHOICES, guestsGetInLabel, guestsGetInPatch, readGuestsGetIn } from './who-can-reply';
import { stripComments } from './strip-comments';
import { allSources, WEB } from './retired-word-guard';

test('an event that never chose reads "Only people on my list" — no write needed', () => {
  for (const never of [null, undefined, {}, { meal: false }]) {
    assert.equal(readWhoCanRsvp(never), 'guest_list');
    assert.equal(readGuestsGetIn(never), 'list');
  }
  // Spelled by the three guest-entry rules (owner 2026-10-02, "THE FIVE GUEST-ENTRY CHOICES…").
  assert.equal(guestsGetInLabel('list'), 'List only · Guests reply');
  assert.equal(GUESTS_GET_IN_CHOICES[0]?.value, 'list', 'the default is the first choice in Event Details');
});

test('choosing it in Event Details stores exactly what the default already reads', () => {
  const patch = guestsGetInPatch('list');
  assert.equal(patch.whoCanRsvp, 'guest_list');
  assert.equal(readGuestsGetIn(patch), 'list');
});

test('the Guests page mounts no first-visit question, and the pop-up is gone', () => {
  assert.equal(
    existsSync(join(WEB, 'app/dashboard/[eventId]/guests/_components/who-can-reply-ask.tsx')),
    false,
    'the "Who can reply?" component is back',
  );
  const page = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/guests/page.tsx'), 'utf8'));
  assert.doesNotMatch(page, /WhoCanReplyAsk|whoCanReplyBase|who-can-reply-ask/, 'the page still asks the question');
  const asking = allSources().filter((f) => stripComments(readFileSync(join(WEB, f), 'utf8')).includes('Who can reply?'));
  assert.deepEqual(asking, [], 'a screen still asks "Who can reply?"');
});
