/**
 * no-row-invite-no-nudge.test.ts — A GUEST ROW HAS NO INVITE AND NO NUDGE
 * (Maker PR 4f · G28, G34). Owner 2026-10-07: *"why is there nudge now?"* — it
 * was invented, nothing sends a reminder · *"so again. you still kept the invite
 * here. how do we invite?"* — ONE way to invite: Select → ✉ Invite N (the
 * one-by-one run), or Setup's Send to N.
 *
 * ⤷ 2026-10-27: the owner put ONE Share on the row ("share and delete only") — the shipped Invite cell drawn as an icon
 * (`GuestInviteCell layout="icon"`), so the row still has no sender of its own and no Nudge.
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

test('the verbs are Share · Delete (or Release seat) — never a nudge, never a second invite (executed, every case)', () => {
  // ⤷ 2026-10-27 (owner, DECISION_LOG "GUEST ROW = SHARE + DELETE"): the row's Share IS the one Send button — the same
  // GuestInviteCell the card draws — so "one way to invite" still holds: one sender, drawn as one icon.
  for (const shareable of [true, false]) {
    const verbs = rowVerbsFor({ role: 'guest' }, { shareable }) as string[];
    assert.ok(verbs.every((v) => ['share', 'remove', 'release'].includes(v)), `a row grew ${verbs.join(',')}`);
  }
  // The couple is never removed (the server refuses them), and the page hands them no token, so no Share.
  assert.deepEqual(rowVerbsFor({ role: 'bride' }, { shareable: false }), []);
});

test('the row component draws no Invite and no Nudge', () => {
  const row = SCREEN.slice(SCREEN.indexOf('function GuestRowLine('));
  assert.ok(row.length > 200, 'GuestRowLine moved — re-aim this guard');
  assert.doesNotMatch(row, /label="Invite"|label=\{`Invite|Nudge|Remind|\bBell\b|\bMail\b/, 'a row has an Invite or Nudge again');
  // The row's only send is the shipped cell as ONE icon — never a second sender drawn in the row itself.
  assert.doesNotMatch(row, /navigator\.share|shareInvite\(|setGuestInvitationSent/, 'the row sends on its own — a second sender');
  // The one Invite is the Select mode's bulk row, into the run.
  assert.match(SCREEN, /label=\{selected\.size === 0 \? 'Invite' : `Invite \$\{selected\.size\}`\}/);
  // ⤷ 2026-10-09: the door is `sendRunHref` (the app's is /guests/send?ids=…; the dev lab hands in its own run).
  assert.match(SCREEN, /router\.push\(sendRunHref\(eventId, invitable\.map/, 'Invite N does not land in the one-by-one run');
});
