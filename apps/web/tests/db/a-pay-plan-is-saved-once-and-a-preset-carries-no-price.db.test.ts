/**
 * CARD MAKER HYBRID PART 2 — the schema, proved against the replayed migrations.
 *
 *   A · vendor_pay_plans + vendor_services.pay_plan_id + apply_vendor_pay_plan (Payment Strategies, 17 Nov):
 *       a plan is copied onto each named card as the card's OWN schedule rows (the no-show terms on the first),
 *       the card is marked as following it, another shop's card is never touched, a stranger cannot apply it,
 *       a card cannot follow another shop's plan, and "Delete" (retire) leaves every card's copy where it is.
 *   B · vendor_services.description + video_url: optional, a video link is https only, and "Copy to another
 *       branch" carries both and the plan the card follows.
 *   C · service_included_templates: every signed-in account reads, only an admin writes, a row can never carry a
 *       price, and the PROPOSED seed is there (marked is_proposal) with the owner's own Catering rows intact.
 *
 * Every case asserts a VALUE, never only a row count.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { insertLiveCard } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;
const F = {} as Record<'owner' | 'other' | 'stranger' | 'vendor' | 'otherVendor' | 'a' | 'b' | 'foreign' | 'plan' | 'cebu', string>;

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function errorOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}
async function mkUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'vendor')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function mkShop(uid: string, name: string): Promise<string> {
  const v = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [uid, name],
    )
  ).rows[0]!.v;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
    [v, uid],
  );
  return v;
}

const PLAN_ITEMS = [
  {
    label: 'Reservation fee',
    amount_kind: 'percent',
    percent_bps: 3000,
    due_anchor: 'on_lock',
    due_offset_days: 0,
    cancellation_terms: 'The reservation fee holds your date and is not returned.',
    downpayment_non_refundable: true,
    no_show_forfeit: true,
  },
  { label: 'Second payment', amount_kind: 'fixed', amount_centavos: 2_000_000, due_anchor: 'before_event', due_offset_days: 60 },
  { label: 'Pay the balance', amount_kind: 'percent', percent_bps: 7000, due_anchor: 'before_event', due_offset_days: 7 },
];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.owner = await mkUser('plan-owner@part2.test');
  F.other = await mkUser('plan-other@part2.test');
  F.stranger = await mkUser('plan-stranger@part2.test');
  F.vendor = await mkShop(F.owner, 'Casa Lumina');
  F.otherVendor = await mkShop(F.other, 'Other Hall');
  F.a = await insertLiveCard(db, { vendor_profile_id: F.vendor, category: 'photographer', title: 'Garden reception', starting_price_php: 85000 });
  F.b = await insertLiveCard(db, { vendor_profile_id: F.vendor, category: 'photographer', title: 'Poolside reception', starting_price_php: 65000 });
  F.foreign = await insertLiveCard(db, { vendor_profile_id: F.otherVendor, category: 'photographer', title: 'Not yours', starting_price_php: 50000 });
  await db.query(
    `INSERT INTO public.vendor_service_payment_schedules (vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps)
     VALUES ($1, $2, 0, 'Old first payment', 'percent', 5000)`,
    [F.foreign, F.otherVendor],
  );
  F.cebu = (
    await db.query<{ b: string }>(
      `INSERT INTO public.vendor_branches (parent_vendor_profile_id, branch_label, branch_city, branch_radius_km)
       VALUES ($1, 'Cebu', 'Cebu City', 30) RETURNING branch_id AS b`,
      [F.vendor],
    )
  ).rows[0]!.b;
});
after(async () => {
  await db?.close();
});

// ── A · Payment Strategies ──────────────────────────────────────────────────

test('A · the owner saves a named plan; a second live plan with the same name is refused', async () => {
  F.plan = await asUser(F.owner, async () => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO public.vendor_pay_plans (vendor_profile_id, name, items) VALUES ($1, 'My 3-step plan', $2::jsonb) RETURNING pay_plan_id AS id`,
      [F.vendor, JSON.stringify(PLAN_ITEMS)],
    );
    return r.rows[0]!.id;
  });
  const dup = await asUser(F.owner, () =>
    errorOf(() =>
      db.query(`INSERT INTO public.vendor_pay_plans (vendor_profile_id, name, items) VALUES ($1, ' my 3-STEP plan ', '[{"label":"x","amount_kind":"percent","percent_bps":100}]'::jsonb)`, [F.vendor]),
    ),
  );
  assert.match(dup, /duplicate key|vendor_pay_plans_live_name_uidx/);
});

test('A · another shop cannot read or write this shop’s plans', async () => {
  const seen = await asUser(F.other, async () => (await db.query(`SELECT name FROM public.vendor_pay_plans`)).rows);
  assert.deepEqual(seen, [], 'RLS: the other shop sees none of Casa Lumina’s plans');
  const wrote = await asUser(F.other, () =>
    errorOf(() =>
      db.query(`INSERT INTO public.vendor_pay_plans (vendor_profile_id, name, items) VALUES ($1, 'Sneaky', '[{"label":"x","amount_kind":"percent","percent_bps":100}]'::jsonb)`, [F.vendor]),
    ),
  );
  assert.match(wrote, /row-level security/);
});

test('A · a stranger cannot apply a shop’s plan', async () => {
  const err = await asUser(F.stranger, () =>
    errorOf(() => db.query(`SELECT public.apply_vendor_pay_plan($1, $2, $3::uuid[])`, [F.vendor, F.plan, [F.a]])),
  );
  assert.match(err, /Only this shop can use its pay plans/);
});

test('A · "Use on other cards…" copies the rows onto each card, the terms on the first, and skips another shop’s card', async () => {
  const n = await asUser(F.owner, async () =>
    (await db.query<{ n: number }>(`SELECT public.apply_vendor_pay_plan($1, $2, $3::uuid[]) AS n`, [F.vendor, F.plan, [F.a, F.b, F.foreign]])).rows[0]!.n,
  );
  assert.equal(n, 2, 'two of the three ids are this shop’s cards');
  for (const card of [F.a, F.b]) {
    const rows = (
      await db.query<Record<string, unknown>>(
        `SELECT seq, label, amount_kind, percent_bps, amount_centavos::int AS amount_centavos, due_anchor, due_offset_days,
                cancellation_terms, downpayment_non_refundable, no_show_forfeit
           FROM public.vendor_service_payment_schedules WHERE vendor_service_id = $1 ORDER BY seq`,
        [card],
      )
    ).rows;
    assert.deepEqual(
      rows.map((r) => [r.seq, r.label, r.amount_kind, r.percent_bps, r.amount_centavos, r.due_anchor, r.due_offset_days]),
      [
        [0, 'Reservation fee', 'percent', 3000, null, 'on_lock', 0],
        [1, 'Second payment', 'fixed', null, 2_000_000, 'before_event', 60],
        [2, 'Pay the balance', 'percent', 7000, null, 'before_event', 7],
      ],
    );
    assert.equal(rows[0]!.cancellation_terms, 'The reservation fee holds your date and is not returned.');
    assert.equal(rows[0]!.downpayment_non_refundable, true);
    assert.equal(rows[0]!.no_show_forfeit, true);
    assert.equal(rows[1]!.no_show_forfeit, false, 'the no-show terms belong to the first payment only');
    const follows = (await db.query<{ p: string | null }>(`SELECT pay_plan_id AS p FROM public.vendor_services WHERE vendor_service_id = $1`, [card])).rows[0]!.p;
    assert.equal(follows, F.plan);
  }
  const foreign = (
    await db.query<{ label: string; p: string | null }>(
      `SELECT s.label, v.pay_plan_id AS p FROM public.vendor_service_payment_schedules s
         JOIN public.vendor_services v USING (vendor_service_id) WHERE s.vendor_service_id = $1`,
      [F.foreign],
    )
  ).rows;
  assert.deepEqual(foreign, [{ label: 'Old first payment', p: null }], 'another shop’s card is never touched');
});

test('A · a card cannot follow another shop’s plan', async () => {
  const err = await errorOf(() => db.query(`UPDATE public.vendor_services SET pay_plan_id = $1 WHERE vendor_service_id = $2`, [F.plan, F.foreign]));
  assert.match(err, /That pay plan belongs to another shop/);
});

test('A · "Just this one" clears the link and keeps the card’s rows; Delete (retire) keeps every copy', async () => {
  await asUser(F.owner, () => db.query(`UPDATE public.vendor_services SET pay_plan_id = NULL WHERE vendor_service_id = $1`, [F.b]));
  const b = (await db.query<{ n: number; p: string | null }>(
    `SELECT (SELECT count(*)::int FROM public.vendor_service_payment_schedules WHERE vendor_service_id = $1) AS n,
            (SELECT pay_plan_id FROM public.vendor_services WHERE vendor_service_id = $1) AS p`,
    [F.b],
  )).rows[0]!;
  assert.deepEqual(b, { n: 3, p: null }, 'its own copy — three rows, no plan');

  await asUser(F.owner, () => db.query(`UPDATE public.vendor_pay_plans SET retired_at = now() WHERE pay_plan_id = $1`, [F.plan]));
  const a = (await db.query<{ labels: string }>(
    `SELECT string_agg(label, ' · ' ORDER BY seq) AS labels FROM public.vendor_service_payment_schedules WHERE vendor_service_id = $1`,
    [F.a],
  )).rows[0]!;
  assert.equal(a.labels, 'Reservation fee · Second payment · Pay the balance', 'cards keep their copy');
  const err = await asUser(F.owner, () =>
    errorOf(() => db.query(`SELECT public.apply_vendor_pay_plan($1, $2, $3::uuid[])`, [F.vendor, F.plan, [F.b]])),
  );
  assert.match(err, /not one of yours/, 'a deleted plan can no longer be applied');
  // Undo
  await asUser(F.owner, () => db.query(`UPDATE public.vendor_pay_plans SET retired_at = NULL WHERE pay_plan_id = $1`, [F.plan]));
});

// ── B · description + video link ────────────────────────────────────────────

test('B · description and video link are optional; a video link must be https', async () => {
  const none = (await db.query<{ d: string | null; v: string | null }>(`SELECT description AS d, video_url AS v FROM public.vendor_services WHERE vendor_service_id = $1`, [F.a])).rows[0]!;
  assert.deepEqual(none, { d: null, v: null }, 'no card changes until its supplier types something');
  const bad = await errorOf(() => db.query(`UPDATE public.vendor_services SET video_url = 'http://youtu.be/x' WHERE vendor_service_id = $1`, [F.a]));
  assert.match(bad, /check constraint/);
  const blank = await errorOf(() => db.query(`UPDATE public.vendor_services SET description = '   ' WHERE vendor_service_id = $1`, [F.a]));
  assert.match(blank, /check constraint/);
  await db.query(
    `UPDATE public.vendor_services SET description = 'A garden by the lake for up to 150 guests.', video_url = 'https://youtu.be/abc123' WHERE vendor_service_id = $1`,
    [F.a],
  );
});

test('B · "Copy to another branch" carries the description, the video link and the plan', async () => {
  await setRole('service_role');
  const id = (await db.query<{ id: string }>(`SELECT public.copy_vendor_service_to_branch($1, $2, $3, 70000) AS id`, [F.vendor, F.a, F.cebu])).rows[0]!.id;
  await reset();
  const row = (await db.query<{ d: string; v: string; p: string }>(`SELECT description AS d, video_url AS v, pay_plan_id AS p FROM public.vendor_services WHERE vendor_service_id = $1`, [id])).rows[0]!;
  assert.deepEqual(row, { d: 'A garden by the lake for up to 150 guests.', v: 'https://youtu.be/abc123', p: F.plan });
});

// ── C · Setnayan's starting What's included templates ──────────────────────

test('C · the proposed seed is there, marked a proposal, and the owner’s Catering rows are intact', async () => {
  const cat = (
    await db.query<{ name: string; rows: unknown; source: string; is_proposal: boolean }>(
      `SELECT name, rows, source, is_proposal FROM public.service_included_templates WHERE canonical_service = 'catering'`,
    )
  ).rows;
  assert.equal(cat.length, 1);
  assert.equal(cat[0]!.source, 'owner');
  assert.equal(cat[0]!.is_proposal, true);
  assert.deepEqual(
    (cat[0]!.rows as { name: string }[]).map((r) => r.name),
    ['Type', 'Food tasting', 'Tables and chairs', 'Service booth', 'Staff'],
    'the owner’s five rows, in his order',
  );
  assert.deepEqual((cat[0]!.rows as { options?: string[] }[])[0]!.options, ['Buffet', 'Plated']);
  const counts = (
    await db.query<{ services: number; not_proposal: number }>(
      `SELECT count(DISTINCT canonical_service)::int AS services, count(*) FILTER (WHERE NOT is_proposal)::int AS not_proposal
         FROM public.service_included_templates`,
    )
  ).rows[0]!;
  assert.ok(counts.services >= 250, `the seed covers the live services (got ${counts.services})`);
  assert.equal(counts.not_proposal, 0, 'every seeded template waits for the owner’s review');
});

test('C · a template row can never carry a price', async () => {
  for (const key of ['price', 'amount', 'worth_php', 'price_php']) {
    const err = await errorOf(() =>
      db.query(
        `INSERT INTO public.service_included_templates (canonical_service, name, rows) VALUES ('catering', $1, $2::jsonb)`,
        [`Priced ${key}`, JSON.stringify([{ name: 'Lechon', kind: 'plain', basis: 'none', [key]: 5000 }])],
      ),
    );
    assert.match(err, /check constraint/, `a row with "${key}" is refused`);
  }
});

test('C · a supplier reads the templates and cannot write them; an admin can', async () => {
  const read = await asUser(F.owner, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.service_included_templates WHERE canonical_service = 'catering'`)).rows[0]!.n,
  );
  assert.equal(read, 1);
  const wrote = await asUser(F.owner, () =>
    errorOf(() => db.query(`INSERT INTO public.service_included_templates (canonical_service, name, rows) VALUES ('catering', 'Mine', '[{"name":"x","kind":"plain","basis":"none"}]'::jsonb)`)),
  );
  assert.match(wrote, /permission denied|row-level security/);
  await setRole('service_role');
  await db.query(
    `INSERT INTO public.service_included_templates (canonical_service, name, rows) VALUES ('catering', 'Plated basics', '[{"name":"Plated dinner","kind":"plain","basis":"none"}]'::jsonb)`,
  );
  await reset();
  const names = (await db.query<{ n: string; p: boolean }>(`SELECT name AS n, is_proposal AS p FROM public.service_included_templates WHERE canonical_service = 'catering' ORDER BY name`)).rows;
  assert.deepEqual(names, [
    { n: 'Catering basics', p: true },
    { n: 'Plated basics', p: false },
  ]);
});
