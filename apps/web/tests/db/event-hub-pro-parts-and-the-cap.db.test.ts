/**
 * 💎 EVENT HUB PRO, PART BY PART — against the replayed schema (owner 2026-10-22, DECISION_LOG "EVENT HUB PRO, PART
 * BY PART"; migration 20271282742262).
 *
 *   · the eleven parts are catalogue rows at the owner's prices (BIG ₱1,000 · SMALL ₱500), on sale, with NO sign-up
 *     price (onboarding keeps its one offer), and Full Pro is the one price ₱6,590 (2026-10-28), no sign-up override;
 *   · THE CAP, measured on real rows: the event's paid part orders — read the way the render reads them
 *     (`event_entitlement_facts`) — priced from the catalogue, fed to the one cap function (`hubOwnershipFrom`):
 *     ₱4,500 paid is not everything; ₱5,000 is everything ONLY for parts bought before the old-cap cutover (owner
 *     2026-10-28, "Keep their full Pro") — the same total after it is not; a refunded order counts for nothing; a part paid twice counts once;
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
  HUB_PART_PAID_CODES,
  hubLegacyPartLinesFrom,
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

test('the eleven parts keep the owner’s prices but are OFF SALE — Event Hub Pro is sold whole (owner 2026-10-26)', async () => {
  /* RE-AIMED 2026-10-26 (owner: "just have the upgrade event hub pro" → "no more by part as well on the website"):
     migration 20271290543004 takes every part off sale. The rows stay, at their prices, so a part already paid for
     still counts toward the cap at its web value (`hubPartPrices` reads the price whatever `is_active` says). */
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
    assert.equal(row.active, false, `${row.code} is on sale — Event Hub Pro is sold whole`);
    assert.equal(row.signup, null, `${row.code} carries a sign-up price — onboarding sells Full Pro only`);
  }
  /* …and every part the code names has its row. */
  for (const p of HUB_PARTS) assert.ok(r.rows.some((x) => x.code === p.sku), `${p.name} has no catalogue row`);
});

test('Full Pro is the one price ₱6,590, with no sign-up override (2026-10-28)', async () => {
  const r = await db.query<{ php: string; signup: string | null }>(
    `SELECT retail_price_php::text AS php, onboarding_price_php::text AS signup FROM public.platform_retail_catalog_v2
      WHERE service_code = 'COUPLE_WEBSITE_PRO'`,
  );
  assert.equal(Number(r.rows[0]!.php), 6590);
  assert.equal(r.rows[0]!.signup, null);
});

/** A fresh event with these part orders. */
/** After the old-cap cutover (migration `*_hub_pro_parts_keep_the_old_cap.sql`) — a NEW part total. */
const AFTER_CUTOVER = '2026-11-01T00:00:00Z';
/** Inside the week parts were on sale (22–26 Oct 2026) — under the old ₱5,000 cap. */
const PARTS_WEEK = '2026-10-24T03:00:00Z';

async function eventWith(
  orders: Array<{ part: HubPartId; status: string; code?: string }>,
  at: string = AFTER_CUTOVER,
): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Parts Event', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  for (const o of orders) {
    await db.query(
      `INSERT INTO public.orders (event_id, user_id, service_key, description, requested_total_php, status, reference_code, created_at)
       VALUES ($1, NULL, $2, 'part', 1, $3, $4, $5::timestamptz)`,
      [eventId, o.code ?? hubPart(o.part).sku, o.status, nextRef(), at],
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
    // ⚖ The old cap, kept — the SAME RPC and parser `eventHubOwnership` asks (owner 2026-10-28, "Keep their full Pro").
    const lr = await db.query<{ l: unknown }>(
      `SELECT public.event_hub_pro_legacy_part_lines($1::uuid, $2::text[]) AS l`,
      [eventId, [...HUB_PART_PAID_CODES]],
    );
    const legacy = hubLegacyPartLinesFrom(lr.rows[0]!.l);
    assert.ok(legacy, 'the old-cap read answered in a shape the app cannot read');
    return hubOwnershipFrom({
      fullHeld: false,
      partHeld: (id) => paid.includes(id),
      paidParts: paid,
      prices: p.parts,
      fullPrice: p.full,
      legacy: {
        capPhp: legacy!.capPhp,
        paidParts: legacy!.lines
          .filter((l) => live.has(l.status ?? ''))
          .map((l) => hubPartOfPaidCode(l.service_key))
          .filter((x): x is HubPartId => x !== null),
      },
    });
  } finally {
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
}

test('₱4,500 of parts is not everything; the rest is the one price less it (₱6,590 − ₱4,500 = ₱2,090)', async () => {
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
  assert.equal(hubRestToEverything(o), 2090);
  assert.equal(o.parts.has('motion'), false);
});

test('⚖ a ₱5,000 part-holder from 22–26 Oct KEEPS everything — footer included — and a refund takes it back', async () => {
  // Owner 2026-10-28, "Keep their full Pro": parts that reached the OLD ₱5,000 cap before the cutover stay everything.
  const id = await eventWith(
    [
      { part: 'reveal', status: 'paid' },
      { part: 'background', status: 'paid' },
      { part: 'photos', status: 'paid' },
      { part: 'style', status: 'paid' },
      { part: 'music', status: 'paid' },
      { part: 'prints', status: 'paid' },
    ],
    PARTS_WEEK,
  );
  const o = await capOf(id, 'active');
  assert.equal(o.paidPhp, 5000);
  assert.equal(o.full, true, 'a part-holder of 22–26 Oct lost the everything they paid ₱5,000 for');
  assert.equal(o.parts.size, 11);
  await db.query(`UPDATE public.orders SET status = 'refunded' WHERE event_id = $1 AND service_key = $2`, [id, hubPart('prints').sku]);
  const after = await capOf(id, 'active');
  assert.equal(after.paidPhp, 4500);
  assert.equal(after.full, false, 'a refunded part still counted toward the old cap');
});

test('⚖ the SAME ₱5,000 of parts bought AFTER the cutover is not everything — new buyers need the one price', async () => {
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
  assert.equal(o.full, false, 'a part total after the cutover was measured against the old cap');
  assert.equal(hubRestToEverything(o), 1590);
});

test('⚖ an old-week order still under review owns nothing yet — the old cap follows the same status rule', async () => {
  const id = await eventWith(
    [
      { part: 'reveal', status: 'paid' },
      { part: 'background', status: 'paid' },
      { part: 'photos', status: 'paid' },
      { part: 'style', status: 'paid' },
      { part: 'music', status: 'paid' },
      { part: 'prints', status: 'submitted' },
    ],
    PARTS_WEEK,
  );
  assert.equal((await capOf(id, 'active')).full, false, 'an unapproved part reached the old cap');
  assert.equal((await capOf(id, 'owned')).full, true, 'the buy surface would ask a part-holder to pay again');
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
  assert.equal(hubRestToEverything(o), 5090);
});
