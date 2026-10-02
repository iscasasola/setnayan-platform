/**
 * a-shared-channel-is-never-automatic.test.ts
 *
 * ⚖ OWNER RULING 2026-09-14 (DECISION_LOG, "SHARED CHANNEL IS OPT-IN AND PRICED"):
 * a shared Setnayan channel is NEVER automatic. The priced opt-in is the hosted-channel
 * add-on, LIVE_STUDIO_HOSTED_CHANNEL (₱3,000/day, on sale since 2026-09-03).
 *
 * THE DEFECT (Sep 1–8 audit; prod flag read 2026-10-02): NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED
 * is "true" in production, and `checkoutPoolChannel` claimed a pool channel for ANY
 * event that pressed Go live — no entitlement check of any kind. Prod held two
 * verified, claimable channels, so the next Live Studio host to go live would have
 * landed on a channel shared with other couples' archived weddings, unpaid and unasked.
 *
 * These tests drive the REAL server path — `checkoutPoolChannel`,
 * `resolveEventBroadcastToken`, `provisionRoamBroadcasts`, and the real
 * `eventSkuActive` underneath them — over a table-routing stand-in for the service
 * client, and the REAL readiness decision + the REAL card the controller renders.
 * No stub of the entitlement itself: the only thing that changes between the two
 * cases is whether an approved LIVE_STUDIO_HOSTED_CHANNEL order exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkoutPoolChannel,
  eventHoldsHostedChannel,
  hostNoticeFromProvision,
  provisionRoamBroadcasts,
  resolveEventBroadcastToken,
} from './live-studio-roam-provision';
import { LIVE_STUDIO_HOSTED_CHANNEL_SKU } from './live-studio-control';
import {
  decideBroadcastReadiness,
  OWN_CHANNEL_HEADLINE,
  poolRouteToAir,
  READY_HEADLINE,
  type ReadinessFacts,
} from './live-studio-readiness';
import {
  mayBroadcastOnSharedChannel,
  ownChannelNoRouteNotice,
  OWN_CHANNEL_GO_LIVE_REFUSAL,
} from './live-studio-pool-only';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

// The components compile with the classic JSX runtime under tsx: React must be global.
(globalThis as { React?: unknown }).React = React;
const { BroadcastReadiness } = require('../app/_components/live-studio/broadcast-readiness') as typeof import('../app/_components/live-studio/broadcast-readiness');

// The production state this whole file is about: the roam flag ON.
process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = 'true';

const POOL = 'live_studio_roam_channel_pool';
const FREE_CHANNEL = {
  id: 3,
  youtube_channel_id: 'UC_pool_channel_3',
  label: 'Setnayan 3',
  status: 'available',
  verified: true,
  concurrent_cap: 4,
};

type Query = {
  table: string;
  op: 'select' | 'update';
  filters: Array<[string, unknown]>;
  serviceKeys: string[] | null;
};

/**
 * A service-role stand-in that answers by TABLE, and records every query so a test
 * can prove the pool was never even read. `hosted` decides one thing only: whether
 * `orders` holds an approved LIVE_STUDIO_HOSTED_CHANNEL row for the event.
 * `'unreadable'` makes `orders` fail the way a real outage does.
 */
function makeAdmin(opts: { hosted: boolean | 'unreadable'; zones?: number }) {
  const log: Query[] = [];
  const many = (q: Query) => {
    if (q.table === 'orders') {
      if (opts.hosted === 'unreadable') return { data: null, error: { code: '08006', message: 'connection_failure' } };
      const asksHosted = (q.serviceKeys ?? []).includes(LIVE_STUDIO_HOSTED_CHANNEL_SKU);
      return { data: opts.hosted === true && asksHosted ? [{ status: 'paid' }] : [], error: null };
    }
    if (q.table === 'live_studio_roam_zones') {
      const n = opts.zones ?? 0;
      return {
        data: Array.from({ length: n }, (_, i) => ({
          id: i + 1,
          zone_index: i,
          label: `Camera ${i + 1}`,
          venue_label: null,
          is_featured: i === 0,
          is_main_stage: i === 0,
          status: 'planned',
        })),
        error: null,
      };
    }
    return { data: [], error: null };
  };
  const single = (q: Query) => {
    if (q.table === POOL) {
      if (q.op === 'update') return { data: { ...FREE_CHANNEL, status: 'checked_out' }, error: null };
      if (q.filters.some(([c]) => c === 'checked_out_event_id')) return { data: null, error: null };
      return { data: FREE_CHANNEL, error: null };
    }
    const m = many(q);
    return { data: Array.isArray(m.data) ? (m.data[0] ?? null) : null, error: m.error };
  };
  const client = {
    from(table: string) {
      const q: Query = { table, op: 'select', filters: [], serviceKeys: null };
      log.push(q);
      const b: Record<string, unknown> = {
        select: () => b,
        update: () => {
          q.op = 'update';
          return b;
        },
        eq: (c: string, v: unknown) => {
          q.filters.push([c, v]);
          return b;
        },
        neq: () => b,
        not: () => b,
        lt: () => b,
        order: () => b,
        limit: () => b,
        in: (c: string, v: unknown) => {
          if (c === 'service_key' && Array.isArray(v)) q.serviceKeys = v as string[];
          return b;
        },
        maybeSingle: () => Promise.resolve(single(q)),
        single: () => Promise.resolve(single(q)),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(many(q)).then(res, rej),
      };
      return b;
    },
    // No comp, not internal, no founder seat — an ordinary couple's event.
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  const touchedPool = () => log.some((q) => q.table === POOL);
  const claimedPool = () => log.some((q) => q.table === POOL && q.op === 'update');
  return { admin: client as unknown as SupabaseClient, log, touchedPool, claimedPool };
}

/* ── 1 · THE SERVER — the one door onto the pool ─────────────────────────── */

test('⚖ an event WITHOUT the hosted channel is refused a shared channel — and the pool is never even read', async () => {
  const { admin, touchedPool, claimedPool } = makeAdmin({ hosted: false });
  assert.equal(await eventHoldsHostedChannel(admin, 'evt_plain'), false);
  assert.equal(await checkoutPoolChannel(admin, 'evt_plain'), null, 'a free, verified channel must NOT be handed out');
  assert.equal(claimedPool(), false, 'no pool row may be claimed for an un-hosted event');
  assert.equal(touchedPool(), false, 'the entitlement is asked BEFORE any pool read');
});

test('⚖ the go-live token resolver refuses the same event — it falls back to the host’s own channel', async () => {
  const { admin, claimedPool } = makeAdmin({ hosted: false });
  assert.equal(await resolveEventBroadcastToken(admin, 'evt_plain'), null);
  assert.equal(claimedPool(), false);
});

test('⚖ an event WITH an approved hosted-channel order gets the shared channel', async () => {
  const { admin, claimedPool } = makeAdmin({ hosted: true });
  assert.equal(await eventHoldsHostedChannel(admin, 'evt_hosted'), true);
  const channel = await checkoutPoolChannel(admin, 'evt_hosted');
  assert.ok(channel, 'the buyer of the hosted channel must be given one');
  assert.equal(channel.id, FREE_CHANNEL.id);
  assert.equal(claimedPool(), true);
});

test('⚖ FAIL CLOSED — an unreadable entitlement is "no", never "yes"', async () => {
  const { admin, claimedPool } = makeAdmin({ hosted: 'unreadable' });
  assert.equal(await eventHoldsHostedChannel(admin, 'evt_x'), false);
  assert.equal(await checkoutPoolChannel(admin, 'evt_x'), null);
  assert.equal(claimedPool(), false);
});

test('⚖ per-camera provisioning names the TRUE reason, and the host is not told to wait for a channel', async () => {
  const { admin, claimedPool } = makeAdmin({ hosted: false, zones: 3 });
  const result = await provisionRoamBroadcasts(admin, 'evt_plain');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not_hosted', 'an un-hosted event must not read as "no channel free right now"');
  assert.equal(claimedPool(), false);
  // Nothing the host bought went missing — no "cameras could not start" banner.
  assert.equal(hostNoticeFromProvision(result), null);
});

/* ── 2 · THE HONEST UI — the same answer, on the surfaces that render it ──── */

const facts = (o: Partial<ReadinessFacts> = {}): ReadinessFacts => ({
  oauthConfigured: true,
  hostedChannelOwned: true,
  channelAvailable: true,
  channelConnected: true,
  channelNeedsReauth: false,
  cameraCount: 2,
  provisionedCount: 0,
  ...o,
});

test('⚖ a free, healthy pool channel is NOT a route to air without the hosted channel', () => {
  assert.equal(poolRouteToAir(facts()), true);
  assert.equal(poolRouteToAir(facts({ hostedChannelOwned: false })), false);
});

test('⚖ the controller’s readiness card shows each event its real door', () => {
  const owner = renderToStaticMarkup(
    React.createElement(BroadcastReadiness, { readiness: decideBroadcastReadiness(facts()) }),
  );
  assert.ok(owner.includes(READY_HEADLINE), 'a hosted-channel owner sees the Setnayan channel ready');
  assert.match(owner, /Your Setnayan channel is connected/);

  // Even a pool that needs re-connecting is not graded for someone it is not for.
  const plain = renderToStaticMarkup(
    React.createElement(BroadcastReadiness, {
      readiness: decideBroadcastReadiness(facts({ hostedChannelOwned: false, channelNeedsReauth: true })),
    }),
  );
  assert.ok(plain.includes(OWN_CHANNEL_HEADLINE), 'an un-hosted event is told its route is its own channel');
  assert.match(plain, /paste its watch link/);
  assert.doesNotMatch(plain, /reserved for your event|Your Setnayan channel|needs to be re-connected|Not ready/);
});

test('⚖ the shared-channel strike warning follows ownership, like the server', () => {
  assert.equal(mayBroadcastOnSharedChannel(true), true, 'flag on + owner → may be on a shared channel → warned');
  assert.equal(mayBroadcastOnSharedChannel(false), false, 'flag on + no add-on → never on a shared channel → not warned');
});

test('⚖ an un-hosted host is never promised that Setnayan will free a channel up', () => {
  for (const sentence of [ownChannelNoRouteNotice(true), ownChannelNoRouteNotice(false), OWN_CHANNEL_GO_LIVE_REFUSAL]) {
    assert.match(sentence, /your own YouTube channel/);
    assert.match(sentence, /hosted channel option/);
    assert.doesNotMatch(sentence, /free one up|on our side|contact Setnayan/i);
  }
  // Pool-only removes the Connect button, so "connect it" must not be the advice then.
  assert.doesNotMatch(ownChannelNoRouteNotice(true), /connect it/i);
  assert.match(ownChannelNoRouteNotice(true), /paste its watch link/);
});

/* ── 3 · REACHABLE — the controller actually hands the row its ownership ──── */

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('⚖ the controller feeds the go-live row the event’s real ownership, and the row branches on it', () => {
  const page = read('../app/panood/control/[eventId]/page.tsx');
  const row = page.slice(page.indexOf('<TransportRow'), page.indexOf('/>', page.indexOf('<TransportRow')));
  assert.match(row, /ownsHostedChannel=\{ownsHostedChannel\}/);
  assert.match(page, /const ownsHostedChannel = await eventSkuActive\(supabase, eventId, LIVE_STUDIO_HOSTED_CHANNEL_SKU\)/);

  const transport = read('../app/panood/control/[eventId]/transport-row.tsx');
  assert.match(
    transport,
    /ownsHostedChannel\s*\?\s*'No broadcast channel is ready for this event yet\.[^']*'\s*:\s*ownChannelNoRouteNotice\(liveStudioPoolOnly\(\)\)/,
    '"wait for Setnayan to free one up" must be said only to a hosted-channel owner',
  );
});
