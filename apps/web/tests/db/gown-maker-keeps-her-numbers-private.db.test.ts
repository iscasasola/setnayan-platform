/**
 * 👗 THE GOWN MAKER KEEPS HER NUMBERS PRIVATE — the database half of step B1 of the gown maker port (corpus
 * WHATS_NEXT_Gown_Maker_Port_2026-11-27.md § 3; DECISION_LOG 2026-11-27). Migration 20271365509280.
 *
 *   1 · A bride (a host of the event) reads the design she sent in her own chat — and not a design in another
 *       thread, of another event, with another shop.
 *   2 · Her body numbers are read by the event's hosts and that shop only: a GUEST of the same event reads nothing,
 *       another shop reads nothing.
 *   3 · The designer's tape (gown_fittings) is the shop's only: the bride, her co-host and another shop read nothing.
 *   4 · A shop's options, fabrics (with their per-metre price) and looks are the shop's only: a bride in that
 *       shop's chat reads none of them directly (the server hands her the public columns), another shop neither.
 *       gown_designs carries no column that could hold a cost line.
 *   5 · Nobody signed in writes any of the six tables (only the server does), and anon reaches nothing.
 *   6 · The size caps hold, a design's shop is its chat's shop, and a design is in a chat or shared as a QR.
 *   7 · The fabric-type registry: the prototype's 15, readable by anyone signed in, unverified, and a type a fabric
 *       uses cannot be deleted.
 *   8 · The Attire Maker SKU exists and its price is the Cake Maker's (one price for every top-band tool).
 *
 * Sabotage (measured before hand-over, 27 Nov 2026): see the PR body for each before → after.
 *
 * Run: cd apps/web && npx tsx --test tests/db/gown-maker-keeps-her-numbers-private.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

// Event A: a bride and her co-host, a guest; shop A is her designer. Event B: another couple with shop B.
let bride: string;
let cohost: string;
let guest: string;
let designerA: string;
let designerB: string;
let otherBride: string;
let shopA: string;
let shopB: string;
let threadA: string;
let threadB: string;
let designA: string;
let designB: string;

const GOWN_TABLES = [
  'gown_fabric_types',
  'vendor_gown_makers',
  'vendor_gown_fabrics',
  'vendor_gown_looks',
  'gown_designs',
  'gown_fittings',
] as const;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  const row = r.rows[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

async function newUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  return one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id AS v`,
    [email, accountType],
  );
}

async function shopOf(user: string, name: string): Promise<string> {
  // A vendor sign-up may already hold its shop row (the sign-up trigger) — reuse it, as the other DB tests do.
  const existing = await db.query<{ vendor_profile_id: string }>(`SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`, [user]);
  return (
    existing.rows[0]?.vendor_profile_id ??
    one<string>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
       VALUES ($1, $2, 'Manila', ARRAY['bridal_gown_custom']::text[]) RETURNING vendor_profile_id AS v`,
      [user, name],
    )
  );
}

/** Run `sql` as a signed-in person (RLS on). Returns the rows, or throws what the database threw. */
async function asUser(uid: string, sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, uid);
    return (await db.query<Record<string, unknown>>(sql, params)).rows;
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
}

async function seen(uid: string, table: string, where = 'TRUE', params: unknown[] = []): Promise<number> {
  return (await asUser(uid, `SELECT 1 FROM public.${table} WHERE ${where}`, params)).length;
}

const BODY = { vals: { height: 160, weight: 52, bust: 86, waist: 66, hips: 92 }, bra: '34B' };
const MEASURES = { bust: { cm: 86, source: 'typed' }, waist: { cm: 66, source: 'typed' } };
const QUANTITIES = { outerMetres: 6.5, liningMetres: 4, beads: {} };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);

  bride = await newUser('gown-bride@test.test', 'customer');
  cohost = await newUser('gown-cohost@test.test', 'customer');
  guest = await newUser('gown-guest@test.test', 'customer');
  otherBride = await newUser('gown-other-bride@test.test', 'customer');
  designerA = await newUser('gown-shop-a@test.test', 'vendor');
  designerB = await newUser('gown-shop-b@test.test', 'vendor');
  shopA = await shopOf(designerA, 'Atelier Ana');
  shopB = await shopOf(designerB, 'Bahay Bea');

  const eventA = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ('Ana turns 30', 'birthday') RETURNING event_id AS v`);
  const eventB = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ('Cora turns 40', 'birthday') RETURNING event_id AS v`);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple'), ($1, $3, 'couple'), ($1, $4, 'guest')`, [eventA, bride, cohost, guest]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventB, otherBride]);

  threadA = await one<string>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id AS v`,
    [eventA, shopA, bride],
  );
  threadB = await one<string>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id AS v`,
    [eventB, shopB, otherBride],
  );

  // What the server writes (service role = no RLS here).
  const send = `INSERT INTO public.gown_designs (vendor_profile_id, thread_id, config, body, measures, quantities, estimate_centavos, created_by)
                VALUES ($1, $2, '{"v":1}'::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, NULL, $6) RETURNING design_id AS v`;
  designA = await one<string>(send, [shopA, threadA, JSON.stringify(BODY), JSON.stringify(MEASURES), JSON.stringify(QUANTITIES), bride]);
  designB = await one<string>(send, [shopB, threadB, JSON.stringify(BODY), JSON.stringify(MEASURES), JSON.stringify(QUANTITIES), otherBride]);
  await db.query(`INSERT INTO public.gown_fittings (design_id, fit, updated_by) VALUES ($1, '{"bust":87.5}'::jsonb, $2), ($3, '{"bust":90}'::jsonb, $4)`, [designA, designerA, designB, designerB]);
  await db.query(`INSERT INTO public.vendor_gown_makers (vendor_profile_id, options) VALUES ($1, '{"v":1}'::jsonb)`, [shopA]);
  await db.query(
    `INSERT INTO public.vendor_gown_fabrics (vendor_profile_id, kind, name, type_id, price_per_metre_centavos) VALUES ($1, 'fabric', 'Ivory mikado', 'mikado', 1), ($1, 'lace', 'Chantilly', 'lace', NULL)`,
    [shopA],
  );
  await db.query(`INSERT INTO public.vendor_gown_looks (vendor_profile_id, name, config) VALUES ($1, 'Maria', '{"v":1}'::jsonb)`, [shopA]);
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the gown maker tables', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · a bride reads the design she sent in her own chat, and no other', async () => {
  assert.equal(await seen(bride, 'gown_designs', 'design_id = $1', [designA]), 1, 'the bride cannot read her own design');
  assert.equal(await seen(cohost, 'gown_designs', 'design_id = $1', [designA]), 1, 'her co-host cannot read the design');
  assert.equal(await seen(bride, 'gown_designs', 'design_id = $1', [designB]), 0, 'the bride reads another couple’s design');
  const row = (await asUser(bride, `SELECT body FROM public.gown_designs WHERE design_id = $1`, [designA]))[0];
  assert.deepEqual(row?.body, BODY, 'her numbers did not come back as she sent them');
});

test('2 · her numbers reach the hosts and that shop only — not a guest, not another shop', async () => {
  assert.equal(await seen(designerA, 'gown_designs', 'design_id = $1', [designA]), 1, 'her designer cannot read the design');
  assert.equal(await seen(guest, 'gown_designs'), 0, 'a guest of the same event reads her design');
  assert.equal(await seen(designerB, 'gown_designs', 'design_id = $1', [designA]), 0, 'another shop reads her design');
  assert.equal(await seen(otherBride, 'gown_designs', 'design_id = $1', [designA]), 0, 'another couple reads her design');
});

test('3 · the designer’s tape is the shop’s only', async () => {
  assert.equal(await seen(designerA, 'gown_fittings', 'design_id = $1', [designA]), 1, 'the shop cannot read its own tape');
  assert.equal(await seen(bride, 'gown_fittings'), 0, 'the bride reads the designer’s tape');
  assert.equal(await seen(cohost, 'gown_fittings'), 0, 'her co-host reads the designer’s tape');
  assert.equal(await seen(guest, 'gown_fittings'), 0, 'a guest reads the designer’s tape');
  assert.equal(await seen(designerB, 'gown_fittings', 'design_id = $1', [designA]), 0, 'another shop reads the tape');
  assert.equal(await seen(designerB, 'gown_fittings', 'design_id = $1', [designB]), 1, 'shop B cannot read its own tape');
});

test('4 · a shop’s options, fabrics and looks are the shop’s; a design row holds no cost line', async () => {
  for (const t of ['vendor_gown_makers', 'vendor_gown_fabrics', 'vendor_gown_looks']) {
    assert.ok((await seen(designerA, t)) > 0, `${t}: the shop cannot read its own rows`);
    assert.equal(await seen(bride, t), 0, `${t}: a bride in that shop’s chat reads it directly (her copy comes from the server)`);
    assert.equal(await seen(designerB, t), 0, `${t}: another shop reads it`);
  }
  const cols = (
    await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gown_designs'`,
    )
  ).rows.map((r) => r.column_name);
  const money = cols.filter((c) => /cost|price|centavos|line/i.test(c));
  assert.deepEqual(money, ['estimate_centavos'], `gown_designs carries a money column beyond the one estimate: ${money.join(', ')}`);
});

test('5 · nobody signed in writes the gown tables, and anon reaches nothing', async () => {
  for (const t of GOWN_TABLES) {
    await assert.rejects(asUser(designerA, `DELETE FROM public.${t}`), /permission denied/i, `${t}: a signed-in session may DELETE`);
    await assert.rejects(asUser(designerA, `UPDATE public.${t} SET ${t === 'gown_fittings' ? 'fit_at' : t === 'gown_designs' ? 'created_at' : 'updated_at'} = now()`), /permission denied/i, `${t}: a signed-in session may UPDATE`);
  }
  await assert.rejects(
    asUser(bride, `INSERT INTO public.gown_designs (vendor_profile_id, thread_id, config) VALUES ($1, $2, '{}'::jsonb)`, [shopA, threadA]),
    /permission denied/i,
    'a bride may write a design straight through the API',
  );
  await db.exec(`SET ROLE anon`);
  try {
    for (const t of GOWN_TABLES) await assert.rejects(db.query(`SELECT 1 FROM public.${t}`), /permission denied/i, `anon reads ${t}`);
  } finally {
    await db.exec(`RESET ROLE`);
  }
});

test('6 · the caps hold, the shop is the chat’s, a design is in a chat or shared', async () => {
  const big = (n: number) => JSON.stringify({ pad: 'x'.repeat(n) });
  const ins = `INSERT INTO public.gown_designs (vendor_profile_id, thread_id, config, body) VALUES ($1, $2, $3::jsonb, $4::jsonb)`;
  await assert.rejects(db.query(ins, [shopA, threadA, big(9000), null]), /check constraint/i, 'a config over its cap was stored');
  await assert.rejects(db.query(ins, [shopA, threadA, '{}', big(3000)]), /check constraint/i, 'a body over its cap was stored');
  await assert.rejects(
    db.query(`INSERT INTO public.vendor_gown_makers (vendor_profile_id, options) VALUES ($1, $2::jsonb)`, [shopB, big(17000)]),
    /check constraint/i,
    'shop options over their cap were stored',
  );
  await assert.rejects(db.query(ins, [shopB, threadA, '{}', null]), /must be its chat/i, 'a design was filed under a shop that is not the chat’s');
  await assert.rejects(
    db.query(`INSERT INTO public.gown_designs (vendor_profile_id, config) VALUES ($1, '{}'::jsonb)`, [shopA]),
    /gown_designs_in_a_chat_or_shared/,
    'a design with no chat and no share code was stored',
  );
  await assert.rejects(
    db.query(`INSERT INTO public.gown_designs (vendor_profile_id, config, share_code) VALUES ($1, '{}'::jsonb, $2)`, [shopA, 'a'.repeat(24)]),
    /gown_designs_share_code_has_a_kind/,
    'a share code with no Shortlist/Booked kind was stored',
  );
  // A QR share before any scan: the shop reads it, no couple does.
  const shared = await one<string>(
    `INSERT INTO public.gown_designs (vendor_profile_id, config, share_code, share_as) VALUES ($1, '{}'::jsonb, $2, 'shortlist') RETURNING design_id AS v`,
    [shopA, 'b'.repeat(24)],
  );
  assert.equal(await seen(designerA, 'gown_designs', 'design_id = $1', [shared]), 1, 'the shop cannot read its own QR share');
  assert.equal(await seen(bride, 'gown_designs', 'design_id = $1', [shared]), 0, 'a couple reads a QR share nobody scanned');
  assert.equal(await seen(designerB, 'gown_designs', 'design_id = $1', [shared]), 0, 'another shop reads a QR share');
});

test('7 · the fabric types: the prototype’s 15 plus v207’s 3, read by anyone signed in, unverified, never deleted while used', async () => {
  const n = Number(await one<string>(`SELECT count(*)::text AS v FROM public.gown_fabric_types`));
  assert.equal(n, 18, `the registry holds ${n} types, not the prototype’s 15 + v207’s 3`);
  assert.equal(Number(await one<string>(`SELECT count(*)::text AS v FROM public.gown_fabric_types WHERE verified`)), 0, 'a seeded type claims to be verified');
  assert.equal(await seen(guest, 'gown_fabric_types'), 18, 'a signed-in person cannot read the registry');
  // v207: the FEEL card's numbers, in the existing columns (gloss → sheen, see → sheer); Duchess left satin's aliases.
  const row = async (id: string) => one<string>(`SELECT concat_ws('|', name, family, gsm, stiff, sheen, sheer, stretch) AS v FROM public.gown_fabric_types WHERE type_id = '${id}'`);
  assert.equal(await row('duchess'), 'Duchess satin|satins|240|0.65|0.62|0.00|none');
  assert.equal(await row('bias_satin'), 'Bias satin|satins|110|0.12|0.85|0.00|none');
  assert.equal(await row('taffeta'), 'Taffeta|structured|140|0.70|0.60|0.00|none');
  assert.equal(await one<string>(`SELECT array_to_string(aliases, ',') AS v FROM public.gown_fabric_types WHERE type_id = 'satin'`), 'bridal satin', 'duchess is still an alias of plain satin');
  await assert.rejects(db.query(`DELETE FROM public.gown_fabric_types WHERE type_id = 'mikado'`), /foreign key/i, 'a type a fabric uses was deleted');
});

test('8 · the Attire Maker SKU is priced as the Cake Maker is (no amount typed)', async () => {
  const rows = (
    await db.query<{ sku_code: string; price_php: string; offering_type: string; is_active: boolean }>(
      `SELECT sku_code, price_php::text, offering_type, is_active FROM public.vendor_billing_catalog
        WHERE sku_code IN ('vendor_tool_attire_tool', 'vendor_tool_cake_tool') ORDER BY sku_code`,
    )
  ).rows;
  assert.equal(rows.length, 2, 'the Attire Maker or the Cake Maker row is missing');
  const [attire, cake] = rows;
  assert.equal(attire!.price_php, cake!.price_php, 'the Attire Maker is not priced as the Cake Maker');
  assert.equal(attire!.offering_type, cake!.offering_type);
  assert.equal(attire!.is_active, true);
});

test('9 · B8: her add-ons are kept as ids (none = an empty list), read like the rest of her design, never by another shop', async () => {
  const none = await one<string[]>(`SELECT add_ons AS v FROM public.gown_designs WHERE design_id = $1`, [designA]);
  assert.deepEqual(none, [], 'a design sent without add-ons does not read as none');
  await db.query(`UPDATE public.gown_designs SET add_ons = ARRAY['veil','fittings'] WHERE design_id = $1`, [designA]);
  const mine = (await asUser(bride, `SELECT add_ons FROM public.gown_designs WHERE design_id = $1`, [designA]))[0];
  assert.deepEqual(mine?.add_ons, ['veil', 'fittings'], 'the bride cannot read the add-ons she sent');
  const shop = (await asUser(designerA, `SELECT add_ons FROM public.gown_designs WHERE design_id = $1`, [designA]))[0];
  assert.deepEqual(shop?.add_ons, ['veil', 'fittings'], 'her designer cannot read her add-ons');
  assert.equal((await asUser(designerB, `SELECT add_ons FROM public.gown_designs WHERE design_id = $1`, [designA])).length, 0, 'another shop reads her add-ons');
  // Ids only: no amount, no free text, no list past the cap.
  for (const bad of [['₱500'], ['Veil please'], ['veil', ''], Array.from({ length: 33 }, () => 'veil')]) {
    await assert.rejects(db.query(`UPDATE public.gown_designs SET add_ons = $2 WHERE design_id = $1`, [designA, bad]), /gown_designs_add_ons_are_ids/, `add_ons took ${JSON.stringify(bad).slice(0, 40)}`);
  }
  // Nobody signed in writes them.
  await assert.rejects(asUser(bride, `UPDATE public.gown_designs SET add_ons = ARRAY['veil'] WHERE design_id = $1`, [designA]), /permission denied/i, 'a bride rewrote her add-ons after Send');
});
