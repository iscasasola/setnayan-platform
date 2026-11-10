/**
 * badge-post.test.ts — the Lane S badge composer (owner 2026-11-10), driven against a recording fake client:
 * ONE post per (supplier, badge), through social_posts only, gated on its own switch and on the shop, and never
 * throwing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { allowServerOnly, fakeAdmin, type Answer, type Call } from './lane-s.fixture';

allowServerOnly();

const VID = '3f0c8a52-1b9e-4c55-9a0e-1f2d3c4b5a69';
const NOW = new Date('2026-11-10T03:00:00Z');

const LIVE_SHOP = {
  vendor_profile_id: VID,
  user_id: 'u-1',
  business_name: 'Liwanag Studio',
  business_slug: 'liwanag-studio',
  services: ['photographer'],
  location_city: 'Cebu City',
  hq_region: 'Cebu',
  tier_state: 'pro',
  tier_expires_at: null,
  public_visibility: 'verified',
  verification_state: 'verified',
  is_demo: false,
  social_feature_opt_out: false,
};

type World = {
  switchOn?: boolean | null;
  shop?: Record<string, unknown> | null;
  ownerInternal?: boolean;
  insertError?: Answer['error'];
  throwOnShop?: boolean;
};

function world(w: World = {}) {
  return fakeAdmin((c: Call) => {
    if (c.table === 'social_publish_settings') {
      return { data: { badge_autopost_enabled: w.switchOn === undefined ? true : w.switchOn } };
    }
    if (c.table === 'vendor_profiles') {
      if (w.throwOnShop) throw new Error('network down');
      return { data: w.shop === undefined ? LIVE_SHOP : w.shop };
    }
    if (c.table === 'users') return { data: { is_internal: w.ownerInternal ?? false } };
    if (c.table === 'social_posts' && c.action === 'insert') return { error: w.insertError ?? null };
    return {};
  });
}

const inserts = (calls: Call[]) => calls.filter((c) => c.table === 'social_posts' && c.action === 'insert');

async function compose(keys: string[], w: World = {}) {
  const { composeBadgeSocialPost } = await import('./badge-post');
  const { admin, calls } = world(w);
  await composeBadgeSocialPost(VID, keys, { admin: admin as never, now: NOW });
  return calls;
}

test('a badge just earned composes ONE supplier_badge row with a deterministic source_ref', async () => {
  const calls = await compose(['first_review', 'reviews:5', 'reviews:10']);
  const rows = inserts(calls);
  assert.equal(rows.length, 1, 'one sweep, one post');
  const row = rows[0]!.payload as Record<string, unknown>;
  assert.equal(row.source_type, 'supplier_badge');
  assert.equal(row.source_ref, `${VID}:reviews:10`);
  assert.match(String(row.body), /Liwanag Studio/);
  assert.match(String(row.body), /10 reviews/);
  assert.match(String(row.link_url), /\/v\/liwanag-studio$/);
  // No parallel posting path: it writes the queue row and nothing else — no slot, no status, no platform call.
  assert.equal(row.scheduled_for, undefined, 'the governor assigns the slot, not the composer');
  assert.equal(row.status, undefined, 'the row starts as the table default (scheduled) for the flush');
  assert.deepEqual(
    calls.filter((c) => c.action !== 'select').map((c) => `${c.action}:${c.table}`),
    ['insert:social_posts'],
  );
});

test('the badge switch OFF composes nothing', async () => {
  assert.equal(inserts(await compose(['events:50'], { switchOn: false })).length, 0);
});

test('the switch unreadable (pre-migration) reads as its default, ON', async () => {
  assert.equal(inserts(await compose(['events:50'], { switchOn: null })).length, 1);
});

test('a sample shop, an internal owner, an opted-out or unpublished shop compose nothing', async () => {
  for (const [why, w] of [
    ['sample (demo) shop', { shop: { ...LIVE_SHOP, is_demo: true } }],
    ['owner is_internal', { ownerInternal: true }],
    ['opted out of social', { shop: { ...LIVE_SHOP, social_feature_opt_out: true } }],
    ['not listed', { shop: { ...LIVE_SHOP, public_visibility: 'hidden' } }],
    ['not verified', { shop: { ...LIVE_SHOP, verification_state: 'pending_review' } }],
    ['no such shop', { shop: null }],
  ] as Array<[string, World]>) {
    assert.equal(inserts(await compose(['events:50'], w)).length, 0, why);
  }
});

test('a free shop is posted unnamed', async () => {
  const rows = inserts(await compose(['events:10'], { shop: { ...LIVE_SHOP, tier_state: 'free' } }));
  assert.equal(rows.length, 1);
  const row = rows[0]!.payload as Record<string, unknown>;
  assert.doesNotMatch(`${row.title} ${row.body} ${row.link_url}`, /Liwanag|liwanag/);
  assert.match(String(row.body), /a photographer in Cebu/);
});

test('verified alone posts nothing (vendor_feature announces it) and reads nothing', async () => {
  const calls = await compose(['verified']);
  assert.equal(calls.length, 0, 'no badge worth a post → not even the switch is read');
});

test('a duplicate (23505) is quiet, and nothing ever throws', async () => {
  await compose(['events:50'], { insertError: { code: '23505', message: 'duplicate' } });
  await compose(['events:50'], { insertError: { code: '42P01', message: 'boom' } });
  await compose(['events:50'], { throwOnShop: true });
});

test('the dispatch-half gate agrees with the compose gate', async () => {
  const { isBadgeSocialShareAllowed } = await import('./badge-post');
  assert.equal(await isBadgeSocialShareAllowed(world().admin as never, VID), true);
  assert.equal(await isBadgeSocialShareAllowed(world({ ownerInternal: true }).admin as never, VID), false);
  assert.equal(
    await isBadgeSocialShareAllowed(world({ shop: { ...LIVE_SHOP, social_feature_opt_out: true } }).admin as never, VID),
    false,
  );
  assert.equal(await isBadgeSocialShareAllowed(world({ throwOnShop: true }).admin as never, VID), false, 'fail closed');
});
