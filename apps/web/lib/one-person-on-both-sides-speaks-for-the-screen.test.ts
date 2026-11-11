/**
 * 🏪 ONE PERSON ON BOTH SIDES SPEAKS FOR THE SCREEN (owner, 11 Nov 2026 — live fault, with a screenshot).
 *
 * The owner's one login owns the shop "SetnaProd" and hosts the test event "TEST SetnaProd walk". He sent "Hello" from
 * the SHOP's picked client and saw it as "Indalecio · IC" on the host's side, and a strip of one face: "You · Shared
 * chat · 1 inside". Owner, verbatim: "instead of the shop messaging my user account, it's just me messaging myself" ·
 * "the profile icons is just you. It should be the shop and then you."
 *
 * What this holds (the database half is tests/db/one-person-on-both-sides-speaks-for-the-screen.db.test.ts):
 *   1. THE SEND — every supplier send path says it is the shop's (`sent_as` / `asSide: 'vendor'`), and the core puts it
 *      on the insert; the host's composer says nothing (the old derivation is already right there).
 *   2. THE BUBBLE — a shop message by the same uid is the supplier's own bubble and the host's "theirs", wearing the
 *      SHOP's face, never the host's; the host's message by that uid wears the host's face on the supplier's side.
 *   3. THE STRIP — both sides draw the shop's face FIRST, then "You", and count two inside; the shop's face for your
 *      own uid is not a private-message target.
 *
 * Sabotage (11 Nov 2026): drop `sentAs="vendor"` from the supplier page → 1 RED; drop the `sent_as` insert key → 1 RED;
 * `hostForMessage` ignoring the side → 2 RED; `stripOrder` without the shop-self face → 3 RED; the couple reader
 * dropping a shop whose owner is the viewer again → 3 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { ChatHostStrip } from '@/app/_components/chat/chat-host-strip';
import { stripOrder, SUPPLIER_STRIP_ROLE } from './chat-members';
import { hostForMessage, type ChatHost } from './chat-hosts';
import { ownsBubble } from './chat-bubble-owner';
import { sentAsFromForm } from './chat-sent-as';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const h = React.createElement;

const ME = 'u-indalecio';
/** Him, as the event's host. */
const HOST_ME: ChatHost = { userId: ME, firstName: 'Indalecio', name: 'Indalecio Casasola', role: 'bride', label: null };
/** Him, as the shop — the host page's strip entry (role `supplier`, the shop OWNER's uid, which is his). */
const SHOP_ME: ChatHost = { userId: ME, firstName: 'SetnaProd', name: 'SetnaProd', role: SUPPLIER_STRIP_ROLE, label: null };

test('1 · the SEND — every supplier path says it is the shop’s; the host’s says nothing', () => {
  assert.equal(sentAsFromForm('vendor'), 'vendor');
  assert.equal(sentAsFromForm('couple'), null, 'a form may only ask for the shop side (the host side is the default)');
  assert.equal(sentAsFromForm(null), null);

  const vendorPage = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(vendorPage, /<ChatSendForm[\s\S]*?sentAs="vendor"[\s\S]*?\/>/, 'the supplier’s composer no longer speaks as the shop');
  assert.match(vendorPage, /shopLabel: profile\.business_name/, 'the supplier’s strip lost the shop’s name');
  assert.match(
    read('app/vendor-dashboard/messages/[threadId]/_components/thread-answer-line.tsx'),
    /name=\{CHAT_SENT_AS_FIELD\} value="vendor"/,
    'the supplier’s quick replies no longer speak as the shop',
  );
  assert.match(read('app/api/vendor/chat/[threadId]/send/route.ts'), /asSide: 'vendor'/, 'the supplier app’s endpoint lost its side');
  assert.match(read('lib/chat-actions.ts'), /sentAsFromForm\(formData\.get\(CHAT_SENT_AS_FIELD\)\)[\s\S]*?asSide \}\)/, 'the form’s side never reaches the core');

  const core = read('lib/chat-send.ts');
  assert.match(core, /if \(asSide === 'vendor'\) \{[\s\S]*?senderRole = 'vendor';/, 'the core still tests couple first for a shop send');
  assert.match(core, /sent_as: asSide,/, 'the side never reaches the insert — the database falls back to couple-first');
  assert.match(core, /\.insert\(\{[\s\S]*?\.\.\.sidePayload,[\s\S]*?\}\);/, 'the side payload is built but never inserted');

  // The host's page never asks for a side: a coordinator posting there must keep the old derivation.
  assert.doesNotMatch(read('app/dashboard/[eventId]/messages/[threadId]/page.tsx'), /sentAs=/, 'the host’s composer started naming a side');
});

test('2 · the BUBBLE — the same uid wears the face of the side it spoke for', () => {
  const shopHello = { sender_role: 'vendor', sender_user_id: ME };
  const hostAsk = { sender_role: 'couple', sender_user_id: ME };

  // The supplier's screen: his shop's "Hello" is HIS bubble; his host question is the client's.
  assert.equal(ownsBubble(shopHello, 'vendor', ME), true, 'the shop’s own message is not the supplier’s bubble');
  assert.equal(ownsBubble(hostAsk, 'vendor', ME), false);
  assert.equal(hostForMessage(hostAsk, [HOST_ME])?.firstName, 'Indalecio', 'the host’s message lost the host’s face');
  assert.equal(hostForMessage(shopHello, [HOST_ME]), null, 'a shop message wore the HOST’s face on the supplier’s side');

  // The host's screen: the shop's "Hello" is THEIRS, wearing the SHOP's face (the entry first in the list on purpose —
  // a lookup by uid alone would hand back whichever entry it met).
  assert.equal(ownsBubble(shopHello, 'couple', ME), false, 'the shop’s message drew as the host’s own words');
  for (const hosts of [
    [SHOP_ME, HOST_ME],
    [HOST_ME, SHOP_ME],
  ]) {
    assert.equal(hostForMessage(shopHello, hosts)?.firstName, 'SetnaProd', 'the shop’s message wore the host’s face');
    assert.equal(hostForMessage(hostAsk, hosts)?.firstName, 'Indalecio', 'the host’s message wore the shop’s face');
  }
  assert.match(
    read('app/_components/chat-message-stream.tsx'),
    /const host = !mine \? hostForMessage\(m, hosts\) : null;/,
    'the stream went back to a uid-only face lookup',
  );
});

test('3 · the STRIP — the shop first, then You, two inside, on both sides', () => {
  const faces = (xs: { key: string; isYou: boolean }[]) => xs.map((x) => (x.isYou ? `you:${x.key}` : x.key));

  // Supplier's side: the hosts list is the event's side (him); the shop's face comes from its name.
  assert.deepEqual(faces(stripOrder([HOST_ME], ME, 'vendor', 'SetnaProd')), [`shop:${ME}`, `you:${ME}`]);
  // Host's side: the shop is in the list under his uid; it stays the shop, he is You.
  assert.deepEqual(faces(stripOrder([SHOP_ME, HOST_ME], ME, 'couple')), [`shop:${ME}`, `you:${ME}`]);
  // Anti-vacuity: a supplier who is NOT a host keeps the one "You" first, as before; no name → no extra face.
  assert.deepEqual(faces(stripOrder([HOST_ME], 'u-staff', 'vendor', 'SetnaProd')), ['you:u-staff', ME]);
  assert.deepEqual(faces(stripOrder([HOST_ME], ME, 'vendor')), [`you:${ME}`]);

  for (const [side, hosts, shopLabel] of [
    ['vendor', [HOST_ME], 'SetnaProd'],
    ['couple', [SHOP_ME, HOST_ME], null],
  ] as const) {
    const html = renderToStaticMarkup(
      h(ChatHostStrip, { hosts, presentIds: new Set([ME]), youId: ME, threadId: 't1', viewerSide: side, shopLabel }),
    );
    const shopAt = html.indexOf('SetnaProd');
    const youAt = html.indexOf('>You<');
    assert.ok(shopAt >= 0, `${side}: the strip omits the shop`);
    assert.ok(youAt > shopAt, `${side}: the shop is not first, then You`);
    assert.match(html, /Shared chat · 2 inside · 1 in the chat now/, `${side}: two parties, one person in the chat now`);
    assert.doesNotMatch(html, /Indalecio/, `${side}: the strip named the person instead of "You"`);
    assert.doesNotMatch(html, /Message SetnaProd privately/, `${side}: your own shop became a private-message target`);
  }

  // The host page's reader keeps the shop when its owner is the viewer.
  assert.doesNotMatch(read('lib/chat-strip-people.server.ts'), /shopUser !== opts\.viewerId/, 'the host side drops a shop the viewer owns again');
});
