/**
 * no-row-invite-no-nudge.test.ts — A GUEST ROW HAS NO INVITE AND NO NUDGE
 * (Maker PR 4f · G28, G34). Owner 2026-10-07: *"why is there nudge now?"* — it
 * was invented, nothing sends a reminder · *"so again. you still kept the invite
 * here. how do we invite?"* — ONE way to invite: Select → ✉ Invite N (the
 * one-by-one run), or Setup's Send to N.
 *
 * SABOTAGE (seen red): add a `✉ Invite` ActionButton to GuestRowLine.
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

test('the verbs are Message · Edit · Remove — never invite, never nudge (executed, every reply)', () => {
  for (const linked of [true, false, null] as const) {
    for (const chatHref of ['/c', null]) {
      const verbs = rowVerbsFor({ role: 'guest' }, { linked, chatHref }) as string[];
      assert.ok(verbs.every((v) => ['message', 'edit', 'remove'].includes(v)), `a row grew ${verbs.join(',')}`);
    }
  }
  // The couple is never removed (the server refuses them).
  assert.deepEqual(rowVerbsFor({ role: 'bride' }, { linked: false, chatHref: null }), ['edit']);
});

test('the row component draws no Invite and no Nudge', () => {
  const row = SCREEN.slice(SCREEN.indexOf('function GuestRowLine('));
  assert.ok(row.length > 200, 'GuestRowLine moved — re-aim this guard');
  assert.doesNotMatch(row, /label="Invite"|label=\{`Invite|Nudge|Remind|\bBell\b|\bMail\b/, 'a row has an Invite or Nudge again');
  // The one Invite is the Select mode's bulk row, into the run.
  assert.match(SCREEN, /label=\{selected\.size === 0 \? 'Invite' : `Invite \$\{selected\.size\}`\}/);
  // ⤷ 2026-10-09: the door is `sendRunHref` (the app's is /guests/send?ids=…; the dev lab hands in its own run).
  assert.match(SCREEN, /router\.push\(sendRunHref\(eventId, invitable\.map/, 'Invite N does not land in the one-by-one run');
});
