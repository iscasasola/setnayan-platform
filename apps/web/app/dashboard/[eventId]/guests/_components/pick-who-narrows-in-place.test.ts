/**
 * pick-who-narrows-in-place.test.ts — ⚙ › Invitations' "Pick who" DOES something you can see (owner 2026-10-28: "guest
 * settings beside send to 107 there is a button pick who. that does not show anything").
 *
 * Cause: "Pick who" was a link to the page it sits on (`/guests?select=to-invite`) inside the ⚙ sheet — the sheet stayed
 * open, and `initialSelect` only turned Select on; it never narrowed the list to To invite. Now:
 *   1. COLD (the link, `?select=to-invite`): the RENDERED screen is in Select mode and draws ONLY the To invite rows.
 *   2. IN PLACE (the press, on the Guests screen): the sheet's rows sit inside `PickWhoContext`; the press prevents the
 *      link and calls the screen's `pickWho`, which closes the sheet, turns Select on and sets the `toinvite` filter.
 *   3. The Select bar's "Invite N" still walks the picked in the ONE send run (`sendRunHref`).
 * The press itself is walked in the lab (`/dev/guests-lab?part=setup` → Pick who) — no unit test can click.
 *
 * SABOTAGE (seen red): start `replyFilter` at null for a cold `?select=to-invite` → test 1 draws every row;
 * drop `openSettings(false)` from `pickWho` → test 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { isToInvite } from '@/lib/guest-roster-view';
import { guestRow, renderGuestsScreen } from './render-guests-screen';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const ROWS = stripComments(readFileSync(join(HERE, '..', '..', '_components', 'guest-setup', 'guest-setup-rows.tsx'), 'utf8'));

const ROSTER = [
  guestRow({ guest_id: 'bride1', role: 'bride', rsvp_status: 'attending' }),
  guestRow({ guest_id: 'groom1', role: 'groom', side: 'groom', rsvp_status: 'attending' }),
  guestRow({ guest_id: 'sent1' }),
  guestRow({ guest_id: 'sent2', rsvp_status: 'declined' }),
  guestRow({ guest_id: 'new1', invitation_sent_at: null }),
  guestRow({ guest_id: 'new2', invitation_sent_at: null, side: 'groom' }),
];
const drawnIds = (html: string) => [...html.matchAll(/data-guest-row=""[^>]*?data-guest-id="([^"]+)"/g)].map((m) => m[1]!);

test('cold ?select=to-invite: the RENDERED list is in Select mode and shows only To invite rows', async () => {
  const want = ROSTER.filter((g) => isToInvite(g)).map((g) => g.guest_id).sort();
  assert.deepEqual(want, ['new1', 'new2'], 'the fixture lost its To invite guests');
  const plain = await renderGuestsScreen({ guests: ROSTER });
  assert.ok(drawnIds(plain).length > want.length, 'without Pick who the list draws everyone');
  assert.doesNotMatch(plain, /data-thumb="select"/);

  const picked = await renderGuestsScreen({ guests: ROSTER, initialSelect: true });
  assert.deepEqual(drawnIds(picked).sort(), want, 'Pick who drew guests who are not To invite');
  assert.match(picked, /data-thumb="select"/, 'Pick who did not turn Select on');
  assert.match(picked, /aria-pressed="true"[^>]*data-reply-filter="toinvite"/, 'the To invite door is not shown as the filter');
});

test('in place: Pick who closes the sheet, turns Select on and narrows to To invite — no navigation', () => {
  const body = SCREEN.match(/const pickWho = useCallback\(\(\) => \{([\s\S]*?)\n {2}\}, \[/)?.[1] ?? '';
  assert.ok(body, 'the screen has no pickWho');
  assert.match(body, /openSettings\(false\)/, 'Pick who leaves the ⚙ sheet open over the list');
  assert.match(body, /setSelectMode\(true\)/, 'Pick who does not turn Select on');
  assert.match(body, /setReplyFilter\('toinvite'\)/, 'Pick who does not narrow to To invite');
  assert.match(SCREEN, /<PickWhoContext\.Provider value=\{[^}]*pickWho\}>\{setup\}<\/PickWhoContext\.Provider>/, 'the ⚙ rows cannot reach pickWho');
  // The button: the link stays (cold way in), the press prevents it and calls the screen.
  const btn = ROWS.match(/label="Pick who"([\s\S]*?)\/>/)?.[1] ?? '';
  assert.match(btn, /href=\{setupDoorHref\(eventId, 'pick-who'\)\}/);
  assert.match(btn, /e\.preventDefault\(\);\s*pickWho\(\);/, 'the press still follows the link to the same page');
  assert.match(ROWS, /const pickWho = usePickWho\(\);/);
});

test('the Select bar still sends the picked into the ONE send run', () => {
  assert.match(SCREEN, /router\.push\(sendRunHref\(eventId, invitable\.map\(\(g\) => g\.guest_id\)\)\)/);
});
