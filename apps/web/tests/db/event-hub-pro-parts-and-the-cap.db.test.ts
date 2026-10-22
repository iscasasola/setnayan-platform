/**
 * 💎 EVENT HUB PRO, PART BY PART — against the replayed schema (owner 2026-10-22, DECISION_LOG "EVENT HUB PRO, PART
 * BY PART"; migration 20271282742262).
 *
 *   · the eleven parts are catalogue rows at the owner's prices (BIG ₱1,000 · SMALL ₱500), on sale, with NO sign-up
 *     price (onboarding keeps its one offer), and Full Pro keeps ₱5,000 / ₱3,000;
 *   · THE CAP, measured on real rows: the event's paid part orders — read the way the render reads them
 *     (`event_entitlement_facts`) — priced from the catalogue, fed to the one cap function (`hubOwnershipFrom`):
 *     ₱4,500 paid is not everything, ₱5,000 is; a refunded order counts for nothing; a part paid twice counts once;
 *     a still-submitted order owns nothing yet (the handshake) but counts toward the buy surface's rest.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import {
  FULL_PRO_SKU,
  HUB_PARTS,
  HUB_PART_SKUS,
  hubOwnershipFrom,
  hubPart,
  hubPartOfPaidCode,
  hubPartOfSku,
  hubRestToEverything,
  type HubPartId,
} from '../../lib/hub-parts';
import { entitlementFactsFrom } from '../../lib/entitlements';

let replay: ReplayResult;
let db: ReplayResult['db'];
let seq = 0;
const nextRef = () => `HUBPART${(seq += 1).toString().padStart(6, '0')}`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function prices(): Promise<{ parts: Map<string, number>; full: number | null }> {
  const r = await db.query<{ code: string; php: string }>(
    `SELECT service_code AS code, retail_price_php::text AS php FROM public.platform_retail_catalog_v2
      WHERE service_code = ANY($1::text[])`,
    [[...HUB_PART_SKUS, FULL_PRO_SKU]],
  );
  const parts = new Map<string, number>();
  let full: number | null = null;
  for (const row of r.rows) {
    if (row.code === FULL_PRO_SKU) full = Number(row.php);
    else parts.set(row.code, Number(row.php));
  }
  return { parts, full };
}

test('the eleven parts are on sale at the owner’s prices, with no sign-up price', async () => {
  const r = await db.query<{ code: string; php: string; signup: string | null; active: boolean }>(
    `SELECT service_code AS code, retail_price_php::text AS php, onboarding_price_php::text AS signup, is_active AS active
       FROM public.platform_retail_catalog_v2 WHERE service_code LIKE 'COUPLE_HUB_PART_%' ORDER BY service_code`,
  );
  assert.equal(r.rows.length, 11, `expected 11 part rows, got ${r.rows.length}`);
  for (const row of r.rows) {
    const part = hubPartOfSku(row.code);
    assert.ok(part, `${row.code} is a catalogue row no part reads`);
    const want = hubPart(part!).size === 'big' ? 1000 : 500;
    assert.equal(Number(row.php), want, `${row.code}: ₱${row.php}, the owner said ₱${want}`);
    assert.equal(row.active, true, `${row.code} is off sale`);
    assert.equal(row.signup, null, `${row.code} carries a sign-up price — onboarding sells Full Pro only`);
  }
  /* …and every part the code names has its row. */
  for (const p of HUB_PARTS) assert.ok(r.rows.some((x) => x.code === p.sku), `${p.name} has no catalogue row`);
});

test('Full Pro keeps its ₱5,000 and its one sign-up price', async () => {
  const r = await db.query<{ php: string; signup: string | null }>(
    `SELECT retail_price_php::text AS php, onboarding_price_php::text AS signup FROM public.platform_retail_catalog_v2
      WHERE service_code = 'COUPLE_WEBSITE_PRO'`,
  );
  assert.equal(Number(r.rows[0]!.php), 5000);
  assert.equal(Number(r.rows[0]!.signup), 3000);
});

/** A fresh event with these part orders. */
async function eventWith(orders: Array<{ part: HubPartId; status: string; code?: string }>): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Parts Event', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  for (const o of orders) {
    await db.query(
      `INSERT INTO public.orders (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
       VALUES ($1, NULL, $2, 'part', 1, $3, $4)`,
      [eventId, o.code ?? hubPart(o.part).sku, o.status, nextRef()],
    );
  }
  return eventId;
}

/** The cap, exactly as `eventHubOwnership` computes it — rows from the render's own facts RPC. */
async function capOf(eventId: string, mode: 'active' | 'owned') {
  await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  try {
    const r = await db.query<{ facts: unknown }>(`SELECT public.event_entitlement_facts($1::uuid) AS facts`, [eventId]);
    const facts = entitlementFactsFrom(r.rows[0]!.facts);
    assert.ok(facts, 'event_entitlement_facts answered in a shape the render cannot read');
    const live = mode === 'active' ? new Set(['paid', 'fulfilled']) : new Set(['submitted', 'awaiting_payment', 'paid', 'fulfilled']);
    const paid = facts!.orders
      .filter((o) => o.status !== null && live.has(o.status))
      .map((o) => hubPartOfPaidCode(o.service_key))
      .filter((p): p is HubPartId => p !== null);
    const p = await prices();
    return hubOwnershipFrom({ fullHeld: false, partHeld: (id) => paid.includes(id), paidParts: paid, prices: p.parts, fullPrice: p.full });
  } finally {
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
}

test('₱4,500 of parts is not everything; the rest is ₱500', async () => {
  const id = await eventWith([
    { part: 'reveal', status: 'paid' },
    { part: 'background', status: 'paid' },
    { part: 'photos', status: 'paid' },
    { part: 'style', status: 'paid' },
    { part: 'music', status: 'fulfilled' },
  ]);
  const o = await capOf(id, 'active');
  assert.equal(o.paidPhp, 4500);
  assert.equal(o.full, false);
  assert.equal(hubRestToEverything(o), 500);
  assert.equal(o.parts.has('motion'), false);
});

test('₱5,000 of parts is everything — footer included — and a refund takes it back', async () => {
  const id = await eventWith([
    { part: 'reveal', status: 'paid' },
    { part: 'background', status: 'paid' },
    { part: 'photos', status: 'paid' },
    { part: 'style', status: 'paid' },
    { part: 'music', status: 'paid' },
    { part: 'prints', status: 'paid' },
  ]);
  const o = await capOf(id, 'active');
  assert.equal(o.paidPhp, 5000);
  assert.equal(o.full, true, '₱5,000 of parts did not unlock everything');
  assert.equal(o.parts.size, 11);
  await db.query(`UPDATE public.orders SET status = 'refunded' WHERE event_id = $1 AND service_key = $2`, [id, hubPart('prints').sku]);
  const after = await capOf(id, 'active');
  assert.equal(after.paidPhp, 4500);
  assert.equal(after.full, false, 'a refunded part still counted toward everything');
});

test('a part paid twice counts once; a submitted order owns nothing yet but counts toward the buy surface', async () => {
  const id = await eventWith([
    { part: 'motion', status: 'paid' },
    { part: 'motion', status: 'paid' },
    { part: 'logo_qr', status: 'submitted' },
  ]);
  const active = await capOf(id, 'active');
  assert.equal(active.paidPhp, 1000, 'one part, bought twice, counted twice');
  assert.equal(active.parts.has('logo_qr'), false, 'a payment under review unlocked a part');
  const owned = await capOf(id, 'owned');
  assert.equal(owned.paidPhp, 1500, 'the buy surface would ask for a part already under review');
});

test('🪄 the retired Animated Monogram reads as Logo & QR — owned, and counted at the part’s web value (PR3)', async () => {
  /* Owner 2026-10-22, Q2: the standalone ₱500 monogram is off sale (migration 20271283592608), and what its owners
     paid is Logo & QR — never asked again, never sold again. */
  const row = await db.query<{ is_active: boolean }>(
    `SELECT is_active FROM public.platform_retail_catalog_v2 WHERE service_code = 'ANIMATED_MONOGRAM'`,
  );
  assert.equal(row.rows[0]?.is_active, false, 'the standalone Animated Monogram is still on sale');
  const id = await eventWith([
    { part: 'logo_qr', status: 'paid', code: 'ANIMATED_MONOGRAM' },
    { part: 'reveal', status: 'paid' },
  ]);
  const o = await capOf(id, 'active');
  assert.equal(o.parts.has('logo_qr'), true, 'a monogram owner does not own Logo & QR');
  assert.equal(o.paidPhp, 1500, 'the monogram did not count at Logo & QR’s web value');
  assert.equal(hubRestToEverything(o), 3500);
});
