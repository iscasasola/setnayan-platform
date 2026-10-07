/**
 * message-needs-an-account.test.ts — 💬 MESSAGE ONLY WITH A SETNAYAN ACCOUNT
 * (Maker PR 4f · G35). Owner 2026-10-07: *"there is chat function if they have
 * setnayan account"* · *"but no account, no chat"*.
 *
 * Two conditions, both required: the guest's name is linked to an account, AND
 * there is a chat to open. ⚠ No couple↔guest chat ships today, so the page hands
 * the screen no chat door and NO row draws Message — a button that opens nothing
 * is the failure this repo keeps meeting (named in the PR).
 *
 * SABOTAGE (seen red): drop the `linked === true` condition in `rowVerbsFor`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { rowVerbsFor } from '@/lib/guest-roster-view';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const PAGE = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));
const guest = { role: 'guest' as const };

test('no account → no Message; an account with no chat to open → no Message (executed)', () => {
  assert.ok(!rowVerbsFor(guest, { linked: false, chatHref: '/x' }).includes('message'), 'a guest with no account can be messaged');
  assert.ok(!rowVerbsFor(guest, { linked: null, chatHref: '/x' }).includes('message'), 'an UNMEASURED account counts as an account');
  assert.ok(!rowVerbsFor(guest, { linked: true, chatHref: null }).includes('message'), 'Message is drawn with nothing to open');
  assert.deepEqual(rowVerbsFor(guest, { linked: true, chatHref: '/chat/1' }), ['message', 'edit', 'remove']);
});

test('the row draws Message only through that answer, and the page reads who has an account', () => {
  const row = SCREEN.slice(SCREEN.indexOf('function GuestRowLine('));
  assert.match(row, /verbs\.includes\('message'\) && chatHref \?/, 'the row draws Message on its own say-so');
  assert.match(SCREEN, /linked: linked \? linked\.has\(g\.guest_id\) : null/, 'the row is not told whether an account holds the guest');
  assert.match(PAGE, /linkedGuestIds=\{linkedGuestIds\}/, 'the page does not hand the screen who has an account');
  assert.doesNotMatch(PAGE, /chatHrefFor=/, 'the page hands a chat door — no couple↔guest chat ships yet');
});
