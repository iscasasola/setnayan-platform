/**
 * SOCIAL MILESTONES COUNT REAL DATA ONLY — BUILD 6 · LANE S (owner 2026-11-10).
 *
 * Before Lane S the flush's milestone sweep posted a bare COUNT(*) of `events` and `guests` to Setnayan's own Page,
 * so the owner's test events, the Maria & Jose sample event and their guests were all "planned on Setnayan".
 * `social_milestone_real_counts()` (migration 20271336072378) is now the ONLY source of those numbers
 * (`lib/social/milestones.ts`), and this file proves, against the replayed schema, that it leaves out:
 *   • events: `is_sample`, and any event whose couple is internal / team / admin;
 *   • suppliers: demo shops, unlisted or unverified shops, shops owned by an internal account;
 *   • guests: every guest on an event that is not real;
 *   • users: internal / team / admin accounts, demo-shop owners, sample-event couples.
 *
 * 🔑 Each exclusion is checked by its own DELTA from a measured baseline — one real row of each kind, then each test
 * row added — so a count that ignored every exclusion would fail on every line, not pass by coincidence.
 * 🔑 And only service_role may call it.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

type Counts = { events_created: number; vendors_verified: number; guests_invited: number; users_joined: number };

async function counts(): Promise<Counts> {
  const r = await db.query<{ c: Counts }>(`SELECT public.social_milestone_real_counts() AS c`);
  const c = r.rows[0]!.c;
  return {
    events_created: Number(c.events_created),
    vendors_verified: Number(c.vendors_verified),
    guests_invited: Number(c.guests_invited),
    users_joined: Number(c.users_joined),
  };
}

let seq = 0;
async function user(kind: 'real' | 'internal' | 'team' | 'admin' = 'real'): Promise<string> {
  seq += 1;
  const id = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [`lane-s-${kind}-${seq}@milestones.test`],
    )
  ).rows[0]!.id;
  if (kind === 'internal') await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [id]);
  if (kind === 'team') await db.query(`UPDATE public.users SET is_team_member = TRUE WHERE user_id = $1`, [id]);
  if (kind === 'admin') await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [id]);
  return id;
}

async function event(opts: { couple?: string; sample?: boolean; guests?: number }): Promise<string> {
  const id = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, is_sample) VALUES ('Lane S event', 'birthday', $1) RETURNING event_id AS e`,
      [opts.sample === true],
    )
  ).rows[0]!.e;
  if (opts.couple) {
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [id, opts.couple]);
  }
  for (let i = 0; i < (opts.guests ?? 0); i += 1) {
    await db.query(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'G', $2, 'both', 'friends')`,
      [id, `n${i}`],
    );
  }
  return id;
}

async function shop(owner: string, opts: { live?: boolean; demo?: boolean } = {}): Promise<string> {
  const id = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Lane S shop') RETURNING vendor_profile_id AS v`,
      [owner],
    )
  ).rows[0]!.v;
  if (opts.live !== false) {
    await db.query(
      `UPDATE public.vendor_profiles
          SET verification_state = 'verified'::public.vendor_verification_state, last_verified_at = NOW(),
              public_visibility = 'verified'::public.vendor_public_visibility
        WHERE vendor_profile_id = $1`,
      [id],
    );
  }
  if (opts.demo) await db.query(`UPDATE public.vendor_profiles SET is_demo = TRUE WHERE vendor_profile_id = $1`, [id]);
  return id;
}

let base: Counts;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  base = await counts();
});

after(async () => {
  await db?.close?.();
});

test('POSITIVE CONTROL: a real couple, their event, two guests and a live shop all count', async () => {
  const couple = await user('real');
  await event({ couple, guests: 2 });
  await shop(await user('real'));
  const now = await counts();
  assert.equal(now.events_created - base.events_created, 1);
  assert.equal(now.guests_invited - base.guests_invited, 2);
  assert.equal(now.vendors_verified - base.vendors_verified, 1);
  assert.equal(now.users_joined - base.users_joined, 2, 'the couple and the shop owner');
  base = now;
});

test('a sample event and its guests are left out — and its couple is not a real user', async () => {
  const sampleCouple = await user('real');
  await event({ couple: sampleCouple, sample: true, guests: 5 });
  const now = await counts();
  assert.equal(now.events_created, base.events_created, 'is_sample event counted');
  assert.equal(now.guests_invited, base.guests_invited, 'sample-event guests counted');
  assert.equal(now.users_joined, base.users_joined, 'sample-event couple counted as a real user');
});

test('an internal, team or admin couple\'s event and its guests are left out, and so are those accounts', async () => {
  for (const kind of ['internal', 'team', 'admin'] as const) {
    await event({ couple: await user(kind), guests: 3 });
  }
  const now = await counts();
  assert.equal(now.events_created, base.events_created, 'a test account\'s event counted');
  assert.equal(now.guests_invited, base.guests_invited, 'a test account\'s guests counted');
  assert.equal(now.users_joined, base.users_joined, 'an internal / team / admin account counted as a real user');
});

test('a real couple whose event has an internal COORDINATOR still counts (only the couple decides)', async () => {
  const couple = await user('real');
  const e = await event({ couple, guests: 1 });
  const coordinator = await user('internal');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'coordinator')`, [e, coordinator]);
  const now = await counts();
  assert.equal(now.events_created - base.events_created, 1);
  assert.equal(now.guests_invited - base.guests_invited, 1);
  assert.equal(now.users_joined - base.users_joined, 1, 'the real couple only');
  base = now;
});

test('demo shops, unlisted shops and internally owned shops are not verified suppliers', async () => {
  const demoOwner = await user('real');
  await shop(demoOwner, { demo: true });
  await shop(await user('real'), { live: false });
  await shop(await user('internal'));
  const now = await counts();
  assert.equal(now.vendors_verified, base.vendors_verified, 'a demo, unlisted or internal shop counted');
  assert.equal(
    now.users_joined - base.users_joined,
    1,
    'of the three owners only the unlisted shop\'s real owner is a real user (demo owner and internal owner are not)',
  );
});

test('only service_role may call it', async () => {
  const r = await db.query<{ anon: boolean; authed: boolean; service: boolean }>(
    `SELECT has_function_privilege('anon', 'public.social_milestone_real_counts()', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.social_milestone_real_counts()', 'EXECUTE') AS authed,
            has_function_privilege('service_role', 'public.social_milestone_real_counts()', 'EXECUTE') AS service`,
  );
  assert.deepEqual(r.rows[0], { anon: false, authed: false, service: true });
});

test('the badge source_type and the two per-type switches exist, default ON', async () => {
  await db.query(
    `INSERT INTO public.social_posts (source_type, source_ref, title, body)
     VALUES ('supplier_badge', 'v:reviews:5', 't', 'b')`,
  );
  const s = await db.query<{ badge: boolean; milestone: boolean }>(
    `SELECT badge_autopost_enabled AS badge, milestone_autopost_enabled AS milestone FROM public.social_publish_settings WHERE id`,
  );
  assert.deepEqual(s.rows[0], { badge: true, milestone: true });
  await assert.rejects(
    db.query(`INSERT INTO public.social_posts (source_type, source_ref, title, body) VALUES ('not_a_type', 'x', 't', 'b')`),
    /social_posts_source_type_check/,
  );
});
