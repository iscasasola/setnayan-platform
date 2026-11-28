/**
 * 👗 HER HAND WORK IS READ LIKE HER DESIGN (gown maker A7b "Place by hand"; migration 20271366154053).
 *
 *   1 · `gown_designs.hand` exists, NULL by default, and a design sent without hand work still saves.
 *   2 · The bride, her co-host and that shop read it; a guest of the same event, another shop and another couple don't;
 *       anon reaches nothing. The designer's tape stays the shop's only.
 *   3 · The cap holds: an object up to 393216 bytes saves; a bigger one, or anything that is not an object, is refused.
 *   4 · Nobody signed in writes it.
 *
 * Run: cd apps/web && npx tsx --test tests/db/gown-designs-hand.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let bride: string, cohost: string, guest: string, otherBride: string, designerA: string, designerB: string;
let shopA: string, shopB: string, threadA: string, designA: string, designPlain: string;

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


const HAND = { handBeads: [{ ph: 0.5, y: 0.3, kind: 'pearl', col: 'ivory', mm: 4, spin: 0 }], handLace: [{ u: 0.2, y: 0.4, rot: 0, id: 'rose', cm: 6 }] };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  bride = await newUser('hand-bride@test.test', 'customer');
  cohost = await newUser('hand-cohost@test.test', 'customer');
  guest = await newUser('hand-guest@test.test', 'customer');
  otherBride = await newUser('hand-other@test.test', 'customer');
  designerA = await newUser('hand-shop-a@test.test', 'vendor');
  designerB = await newUser('hand-shop-b@test.test', 'vendor');
  shopA = await shopOf(designerA, 'Atelier Ana');
  shopB = await shopOf(designerB, 'Bahay Bea');
  const eventA = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ('Ana turns 30', 'birthday') RETURNING event_id AS v`);
  const eventB = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ('Cora turns 40', 'birthday') RETURNING event_id AS v`);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple'), ($1, $3, 'couple'), ($1, $4, 'guest')`, [eventA, bride, cohost, guest]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventB, otherBride]);
  threadA = await one<string>(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1, $2, $3, 'accepted') RETURNING thread_id AS v`, [eventA, shopA, bride]);
  await one<string>(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1, $2, $3, 'accepted') RETURNING thread_id AS v`, [eventB, shopB, otherBride]);
  // What the server writes on Send (service role = no RLS here): one design with hand work, one without.
  designA = await one<string>(`INSERT INTO public.gown_designs (vendor_profile_id, thread_id, config, hand, created_by) VALUES ($1, $2, '{"v":1}'::jsonb, $3::jsonb, $4) RETURNING design_id AS v`, [shopA, threadA, JSON.stringify(HAND), bride]);
  designPlain = await one<string>(`INSERT INTO public.gown_designs (vendor_profile_id, thread_id, config, created_by) VALUES ($1, $2, '{"v":1}'::jsonb, $3) RETURNING design_id AS v`, [shopA, threadA, bride]);
  await db.query(`INSERT INTO public.gown_fittings (design_id, fit, updated_by) VALUES ($1, '{"bust":87.5}'::jsonb, $2)`, [designA, designerA]);
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the hand-work column', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · the column exists, NULL by default: a design without hand work still saves', async () => {
  const col = await db.query<{ is_nullable: string; data_type: string }>(`SELECT is_nullable, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gown_designs' AND column_name = 'hand'`);
  assert.deepEqual(col.rows[0], { is_nullable: 'YES', data_type: 'jsonb' });
  assert.equal(await one<unknown>(`SELECT hand AS v FROM public.gown_designs WHERE design_id = $1`, [designPlain]), null);
});

test('2 · the bride, her co-host and that shop read her hand work; a guest, another shop, another couple and anon do not', async () => {
  for (const [who, name] of [[bride, 'the bride'], [cohost, 'her co-host'], [designerA, 'her designer']] as const) {
    const row = (await asUser(who, `SELECT hand FROM public.gown_designs WHERE design_id = $1`, [designA]))[0];
    assert.deepEqual(row?.hand, HAND, `${name} cannot read the hand work`);
  }
  for (const [who, name] of [[guest, 'a guest'], [designerB, 'another shop'], [otherBride, 'another couple']] as const)
    assert.equal((await asUser(who, `SELECT hand FROM public.gown_designs WHERE design_id = $1`, [designA])).length, 0, `${name} reads her hand work`);
  await db.exec(`SET ROLE anon`);
  try {
    await assert.rejects(db.query(`SELECT hand FROM public.gown_designs`), /permission denied/i, 'anon reads hand work');
  } finally {
    await db.exec(`RESET ROLE`);
  }
  assert.equal((await asUser(bride, `SELECT 1 FROM public.gown_fittings`)).length, 0, 'the bride reads the designer’s tape');
});

test('3 · the cap: an object up to 393216 bytes saves; bigger, or not an object, is refused', async () => {
  const ins = (hand: string) => db.query(`INSERT INTO public.gown_designs (vendor_profile_id, thread_id, config, hand) VALUES ($1, $2, '{"v":1}'::jsonb, $3::jsonb)`, [shopA, threadA, hand]);
  // pg_column_size counts the stored (possibly compressed) value: use text that does not compress.
  const noise = (n: number) => Array.from({ length: n }, (_, i) => ((i * 2654435761) >>> 0).toString(36)).join('');
  await ins(JSON.stringify({ handCuts: [noise(20000)] }));
  await assert.rejects(ins(JSON.stringify({ handCuts: [noise(80000)] })), /gown_designs_hand_is_a_bounded_object/, 'a hand bigger than the cap saved');
  await assert.rejects(ins('[]'), /gown_designs_hand_is_a_bounded_object/, 'an array saved as hand work');
  await assert.rejects(ins('"beads"'), /gown_designs_hand_is_a_bounded_object/, 'a string saved as hand work');
});

test('4 · nobody signed in writes it', async () => {
  await assert.rejects(asUser(bride, `UPDATE public.gown_designs SET hand = '{}'::jsonb WHERE design_id = $1`, [designA]), /permission denied/i);
  await assert.rejects(asUser(designerA, `UPDATE public.gown_designs SET hand = NULL WHERE design_id = $1`, [designA]), /permission denied/i);
});
