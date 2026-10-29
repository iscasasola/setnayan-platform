/**
 * 📥 REQUESTS INSIDE GUESTS (R4 slice 11; HANDOVER "SLICES 9–11": *"Requests inside Guests"*; prototype `SHOW` —
 * "Asking to join" is a Show of the List, with Accept · Decline in place and Undo).
 *
 * Rule 0: nothing is redrawn. The List draws the SHIPPED Requests page in place — `guests/claims/page.tsx` with `maker=1`,
 * the very way the Event Hub Maker draws it (each Accept · Decline · Link revalidates and stays put, with its Undo).
 *
 * The PROPERTIES:
 *   1. The page streams it for the couple only, while someone is asking (or the address asks, `?gshow=requests`).
 *   2. The Total card's door opens it in place (no navigation); without it the door is the Requests page as before.
 *   3. The List's ⇅ offers "Asking to join · N" INSIDE Show (right after its last choice), one ✓ in Show; any other
 *      filter pick goes back to everyone.
 *   4. Rendered: asking → the head "Asking to join · N" + Everyone, then the Requests body, and no guest rows.
 *
 * SABOTAGE (each seen RED, then restored): `maker: '1'` dropped · the door's preventDefault dropped · `setAsking(false)`
 * dropped from pickFilter · the splice index at the end of the menu.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { NO_GUESTS_FILTER } from '@/lib/guests-filter';
import { guestsFilterMenu } from '@/app/dashboard/[eventId]/guests/_components/guests-filter-menu';
import { guestRow, renderGuestsScreen } from '@/app/dashboard/[eventId]/guests/_components/render-guests-screen';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('1 · the page streams the shipped Requests page, in place, for the couple while someone asks', () => {
  const page = src('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(page, /import RequestsPage from '\.\/claims\/page';/);
  assert.match(page, /requestsBody=\{\s*viewer\.isCouple && \(pendingClaimsCount > 0 \|\| search\.gshow === 'requests'\) \?/);
  assert.match(page, /<RequestsPage params=\{Promise\.resolve\(\{ eventId \}\)\} searchParams=\{Promise\.resolve\(\{ maker: '1' \}\)\} \/>/, 'not drawn in place (maker=1)');
  assert.match(page, /initialAsking=\{search\.gshow === 'requests'\}/);
});

test('2 · the Total card’s door opens it in place; without it, the Requests page as before', () => {
  const screen = src('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /href=\{requestsBody \? `\/dashboard\/\$\{eventId\}\/guests\?gshow=requests` : `\/dashboard\/\$\{eventId\}\/guests\/claims`\}/);
  assert.match(screen, /requestsBody\s*\? \(e\) => \{\s*e\.preventDefault\(\);\s*openAsking\(\);/, 'the door navigates away');
  assert.match(screen, /const pickFilter = \(next: GuestsFilter\) => \{\s*setAsking\(false\);/, 'a filter pick keeps the requests up');
});

test('3 · "Asking to join · N" sits inside Show, with the one ✓', () => {
  const menu = guestsFilterMenu({
    view: 'list',
    filter: NO_GUESTS_FILTER,
    onFilter: () => {},
    hasSides: true,
    showExtras: [{ key: 'asking', label: 'Asking to join · 3', group: 'Show', trail: { text: '✓', tone: 'ok', label: 'shown now' } }],
    extras: [{ key: 'select', label: 'Select…', group: 'List' }],
  }).menu;
  const at = menu.findIndex((o) => o.key === 'asking');
  assert.ok(at > 0 && menu[at - 1]!.group === 'Show' && menu[at + 1]!.group !== 'Show', 'Asking to join is not the end of Show');
  assert.equal(menu.filter((o) => o.group === 'Show' && o.trail).map((o) => o.key).join(), 'asking', 'Show carries two ✓');
  assert.equal(menu.at(-1)!.key, 'select');
});

test('4 · rendered: asking → the head, the Requests body, no guest rows', async () => {
  const body = React.createElement('div', { 'data-requests-page': '' }, 'REQUESTS BODY');
  const on = await renderGuestsScreen({ guests: [guestRow({ guest_id: 'g1' })], requests: 3, requestsBody: body, initialAsking: true });
  assert.match(on, /data-guests-asking=""/);
  assert.match(on, /Asking to join · /);
  assert.match(on, /REQUESTS BODY/);
  assert.doesNotMatch(on, /data-guest-row=""/, 'the guest rows draw under the requests');
  const off = await renderGuestsScreen({ guests: [guestRow({ guest_id: 'g1' })], requests: 3, requestsBody: body });
  assert.doesNotMatch(off, /REQUESTS BODY/);
  assert.match(off, /data-guest-row=""/);
  // No body handed in (not the couple) → never "asking", whatever the address says.
  const none = await renderGuestsScreen({ guests: [guestRow({ guest_id: 'g1' })], requests: 3, initialAsking: true });
  assert.doesNotMatch(none, /data-guests-asking/);
});
