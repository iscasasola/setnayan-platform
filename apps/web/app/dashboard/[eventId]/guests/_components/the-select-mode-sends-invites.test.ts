/**
 * the-select-mode-sends-invites.test.ts — STEP 2D: SEND INVITES TO A SELECTION.
 *
 * THE CLAIM: in the live list's Select mode there is ONE forward button, "Invite N", that takes the selected guests who
 * still need an invitation (never the couple, never the already sent) to the existing one-by-one run —
 * `/dashboard/<event>/guests/send?ids=<id,id,…>` — and the run reads exactly that param (`ids`, uuids only). Nothing is
 * selected → the button is WAITING (grey, still a button, a press does nothing), not faded away. Everyone selected is
 * already invited → a note says so and no navigation happens. No new server code: the door is a route push.
 *
 * (The brief for 2D asked to ADD this button; it already existed in `guests-screen.tsx` — Rule 0 — so 2D is its guard, plus
 * the one change the brief asked for: `waiting` instead of `disabled`, here and on "Remove N".)
 *
 * SABOTAGE (each seen RED, then restored): `disabled` put back for `waiting` · the param renamed · the already-invited
 * note dropped (navigates with nobody) · the send page reading a different param.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const SEND = stripComments(readFileSync(join(HERE, '..', 'send', 'page.tsx'), 'utf8'));
const btn = SCREEN.slice(SCREEN.indexOf('label={`Invite ${selected.size}`}') - 120, SCREEN.indexOf('data-testid="bulk-invite"') + 30);

test('Select mode has ONE Invite N, the filled forward button, WAITING while nothing is selected', () => {
  assert.ok(btn.length > 200, 'the Invite N button is gone from Select mode');
  assert.match(btn, /<ActionButton[\s\S]*main[\s\S]*waiting=\{selected\.size === 0\}/);
  assert.doesNotMatch(btn, /disabled=/, 'an empty selection fades the button instead of making it a waiting button');
  assert.equal((SCREEN.match(/data-testid="bulk-invite"/g) ?? []).length, 1, 'more than one send door in Select mode');
  assert.match(SCREEN, /label=\{`Remove \$\{removable\.length\}`\}\s*waiting=\{removable\.length === 0\}/, 'Remove N is not waiting when nothing can be removed');
});

test('it goes to the existing run with the selected, still-to-invite guests’ ids — and says so when there is nobody', () => {
  assert.match(btn, /if \(invitable\.length === 0\) \{\s*toast\.info\('Everyone selected is already invited'\);\s*return;\s*\}/);
  assert.match(btn, /router\.push\(`\/dashboard\/\$\{eventId\}\/guests\/send\?ids=\$\{invitable\.map\(\(g\) => g\.guest_id\)\.join\(','\)\}`\)/);
  assert.match(SCREEN, /const invitable = selectedIds\s*\.map\(\(id\) => byId\.get\(id\)\)\s*\.filter\(\(g\): g is GuestRow => Boolean\(g\) && isToInvite\(g!\)\);/, 'the list sends guests who do not need an invitation');
});

test('the run reads that very param, uuids only', () => {
  assert.match(SEND, /searchParams\?: Promise<\{ ids\?: string \}>/);
  assert.match(SEND, /\(\(await searchParams\)\?\.ids \?\? ''\)\.split\(','\)\.filter\(\(id\) => isUuid\(id\)\)/);
});

test('no new server code: the door is a route push, not an action', () => {
  assert.doesNotMatch(btn, /await |Action\(|startTransition/);
});
