/**
 * 🤝 INVITE A SUPPLIER — the words, the address, and the wiring (owner 16 Nov 2026, "Invite a supplier v3 APPROVED";
 * specs cb1affde). The database half is `tests/db/invite-a-supplier.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADD_PREFERRED_LINE,
  INVITE_INFO,
  ORIGIN_TAG,
  cleanInviteSlug,
  invitesCountLine,
  joinedThroughLinkLine,
  originOf,
  partnerLine,
  supplierInvitePath,
  trustedByHint,
  trustedByLine,
} from './supplier-invite';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('the drawn words, word for word', () => {
  assert.equal(
    ADD_PREFERRED_LINE,
    'Add a Setnayan shop you trust, or invite one that isn’t here yet. You become each other’s preferred supplier.',
  );
  assert.equal(
    INVITE_INFO,
    'When a supplier joins Setnayan through your link, you are each other’s preferred supplier. Each one counts toward your Invites badge after their first completed booking.',
  );
  assert.deepEqual(Object.values(ORIGIN_TAG), ['Worked together', 'Added', 'Invited']);
  assert.equal(trustedByLine('Liwanag Lights & Bar'), 'Suppliers Liwanag Lights & Bar works with.');
  assert.equal(
    trustedByHint({ origin: 'invited', shop: 'Liwanag Lights & Bar', other: 'Bloom & Petal Florals', direction: 'this_shop' }),
    'Joined Setnayan through Liwanag Lights & Bar’s link.',
  );
});

test('the rows say where each tie came from', () => {
  const at = '2026-11-16T03:00:00Z';
  assert.equal(partnerLine({ origin: 'invited', iProposed: true, at }), 'Invited · joined through your link · 16 Nov');
  assert.equal(partnerLine({ origin: 'invited', iProposed: false, at }), 'Invited you · 16 Nov');
  assert.equal(partnerLine({ origin: 'worked_together', iProposed: true, at, events: 2 }), 'Worked together · 2 events');
  assert.equal(partnerLine({ origin: 'worked_together', iProposed: true, at, events: 1 }), 'Worked together · 1 event');
  assert.equal(joinedThroughLinkLine(2), '2 joined through your link');
  assert.equal(joinedThroughLinkLine(0), null, 'nobody yet → the line is not drawn');
});

test('the Invites count line', () => {
  assert.equal(invitesCountLine({ counted: 0, joined: 2 }), '0 counted · 2 joined, waiting for their first completed booking');
  assert.equal(invitesCountLine({ counted: 1, joined: 3 }), '1 counted · 2 joined, waiting for their first completed booking');
  assert.equal(invitesCountLine({ counted: 2, joined: 2 }), '2 counted');
});

test('one address per shop; a junk slug is not a link; an unknown origin is worked together', () => {
  assert.equal(supplierInvitePath('liwanag'), '/i/liwanag');
  assert.equal(cleanInviteSlug(' Liwanag '), 'liwanag');
  for (const junk of ['', '../x', 'a b', null, 7, 'x'.repeat(80)]) assert.equal(cleanInviteSlug(junk), null);
  assert.equal(originOf('added'), 'added');
  assert.equal(originOf(null), 'worked_together');
});

test('a NEW shop made through the link is the one write that counts — read once, cleared either way', () => {
  const src = read('app/open-shop/actions.ts');
  assert.match(src, /const wasNewShop = !\(existing[\s\S]{0,80}business_name\?\.trim\(\)/);
  assert.match(src, /if \(wasNewShop\) await recordNewShopInvite\(admin, invitedVia, vendorProfileId as string\);\s*jar\.delete\(SUPPLIER_INVITE_COOKIE\);/);
  const server = read('lib/supplier-invite.server.ts');
  assert.match(server, /rpc\('supplier_invite_join', \{[\s\S]{0,120}p_new_shop: true/);
  // The existing-shop door never passes p_new_shop — the database's own wrapper decides it (false).
  assert.match(read('app/i/[slug]/actions.ts'), /rpc\('join_supplier_invite', \{ p_inviter_slug: slug \}\)/);
});

test('"+ Add" is the shipped propose with origin added — one flow, not a second one', () => {
  const card = read('app/vendor-dashboard/partnerships/_components/preferred-supplier-card.tsx');
  assert.match(card, /action=\{proposePartnership\}[\s\S]{0,200}name="origin" value="added"/);
  const actions = read('app/vendor-dashboard/partnerships/actions.ts');
  assert.match(actions, /origin: added \? 'added' : 'worked_together'/);
  assert.match(actions, /if \(!added\) \{\s*const servedTogether = await servedTogetherWith/);
});

test('Trusted by reads both directions, the adder’s pending adds, and the worked-with shops', () => {
  const src = read('lib/vendor-trusted-by.ts');
  assert.match(src, /\.or\(`recommending_vendor_id\.eq\.\$\{me\},recommended_vendor_id\.eq\.\$\{me\}`\)/);
  assert.match(src, /if \(r\.status === 'proposed' && !iMade\) continue;/, 'a pending tie shows only on the adder’s page');
  assert.match(src, /rpc\('shop_worked_with_counts'/);
});
