/**
 * A COUPLE SEES EVERY SUPPLIER'S NAME IN CHATS — migration 20271295352678, proven as a REAL `authenticated` session
 * (SET ROLE + JWT claims), never as the superuser the replay otherwise runs as.
 *
 * Owner, live, 2026-10-28, on the couple's Chats › Suppliers list: one thread read "Supplier" (avatar "S") beside
 * another that read its shop name — "the 1 supplier is not named on chat. Why did she not show properly".
 *
 * ── 1 · THE CAUSE, MEASURED ─────────────────────────────────────────────────────────────────────────────────────
 * The pages read the shop through `vendor:vendor_profiles(...)` — a PostgREST many-to-one embed, i.e. a correlated
 * read of `vendor_profiles` under the couple's RLS. That read is replayed here per SHOP STATE, and the test pins
 * exactly which states come back NULL (the page then printed 'Supplier'). Only public + verified shops survive.
 *
 * ── 2 · THE FIX ─────────────────────────────────────────────────────────────────────────────────────────────────
 * `couple_thread_supplier_names(event)` answers for EVERY thread, every state, and the label the server prints
 * (`threadSupplierName`, the same `resolveVendorDisplayName`) is pinned per state — the screen name pre-reveal, the
 * business name once revealed. Never 'Supplier'. An unrevealed shop's business name and logo NEVER come back.
 *
 * ── 3 · THE GATE ────────────────────────────────────────────────────────────────────────────────────────────────
 * A stranger, the supplier themselves, another couple: zero rows. anon: no EXECUTE.
 *
 * ── 4 · PARITY ──────────────────────────────────────────────────────────────────────────────────────────────────
 * The SQL reveal predicate is a twin of TS `isVendorNameRevealed` + `isTrueNameTier`. Every `vendor_tier_state` enum
 * value × every `vendor_verification_state` × venue/not × stamped/not is compared — a tier that changes its name
 * mode in TS without the SQL (or the reverse) turns this red.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { isVendorNameRevealed } from '../../lib/vendors';
import { isTrueNameTier } from '../../lib/vendor-tier-caps';
import { threadSupplierName, type CoupleThreadSupplierRow } from '../../lib/chat-supplier-names';

let replay: ReplayResult;
let db: PGlite;

/** One shop per state the owner's shop could have been in. `embedVisible` = what the couple's RLS lets through. */
type Shop = {
  key: string;
  business_name: string;
  verification_state: string;
  public_visibility: string;
  tier_state: string;
  services: string[];
  location_city: string | null;
  name_revealed_at: string | null;
  screen_name: string | null;
  logo_url: string | null;
  is_demo?: boolean;
  /** What the OLD embed returned to the couple. */
  embedVisible: boolean;
  /** What the couple must now read. */
  expectName: string;
  expectRevealed: boolean;
};

const SHOPS: Shop[] = [
  {
    key: 'public-verified', business_name: 'Saysay Host and Band', verification_state: 'verified',
    public_visibility: 'verified', tier_state: 'free', services: ['band'], location_city: 'Manila',
    name_revealed_at: null, screen_name: 'Manila Band #1001', logo_url: 'logos/saysay.webp',
    embedVisible: true, expectName: 'Saysay Host and Band', expectRevealed: true,
  },
  {
    key: 'free-unverified-coming-soon', business_name: 'Jacq Florals', verification_state: 'unverified',
    public_visibility: 'coming_soon', tier_state: 'free', services: ['florist'], location_city: 'Cebu',
    name_revealed_at: null, screen_name: 'Cebu Florist #2002', logo_url: 'logos/jacq.webp',
    embedVisible: false, expectName: 'Cebu Florist #2002', expectRevealed: false,
  },
  {
    key: 'free-unverified-replied', business_name: 'Jacq Lights', verification_state: 'unverified',
    public_visibility: 'coming_soon', tier_state: 'free', services: ['lights_and_sounds'], location_city: 'Cebu',
    name_revealed_at: '2026-10-01T00:00:00Z', screen_name: 'Cebu Lights #2003', logo_url: 'logos/jl.webp',
    embedVisible: false, expectName: 'Jacq Lights', expectRevealed: true,
  },
  {
    key: 'pending-review', business_name: 'Pending Photo Co', verification_state: 'pending_review',
    public_visibility: 'coming_soon', tier_state: 'free', services: ['photographer'], location_city: 'Davao',
    name_revealed_at: null, screen_name: 'Davao Photographer #3003', logo_url: null,
    embedVisible: false, expectName: 'Davao Photographer #3003', expectRevealed: false,
  },
  {
    key: 'unverified-paid-tier', business_name: 'Solo Cakes', verification_state: 'unverified',
    public_visibility: 'coming_soon', tier_state: 'solo', services: ['cake'], location_city: 'Manila',
    name_revealed_at: null, screen_name: 'Manila Cake #4004', logo_url: 'logos/solo.webp',
    embedVisible: false, expectName: 'Solo Cakes', expectRevealed: true,
  },
  {
    key: 'verified-but-hidden', business_name: 'Hidden Verified Catering', verification_state: 'verified',
    public_visibility: 'hidden', tier_state: 'free', services: ['catering'], location_city: 'Manila',
    name_revealed_at: null, screen_name: 'Manila Caterer #5005', logo_url: null,
    embedVisible: false, expectName: 'Hidden Verified Catering', expectRevealed: true,
  },
  {
    key: 'unverified-venue', business_name: 'Casa Venue', verification_state: 'unverified',
    public_visibility: 'coming_soon', tier_state: 'free', services: ['venue'], location_city: 'Tagaytay',
    name_revealed_at: null, screen_name: null, logo_url: null,
    embedVisible: false, expectName: 'Casa Venue', expectRevealed: true,
  },
  {
    key: 'demo-public-verified', business_name: 'Demo Host Co', verification_state: 'verified',
    public_visibility: 'verified', tier_state: 'free', services: ['host'], location_city: 'Manila',
    name_revealed_at: null, screen_name: null, logo_url: null, is_demo: true,
    embedVisible: true, expectName: 'Demo Host Co', expectRevealed: true,
  },
  {
    // Revealed, but the business name is EMPTY — the resolver's revealed branch would print the bare 'Supplier'.
    key: 'revealed-empty-business-name', business_name: '', verification_state: 'unverified',
    public_visibility: 'coming_soon', tier_state: 'pro', services: ['makeup_artist'], location_city: 'Iloilo',
    name_revealed_at: null, screen_name: 'Iloilo Makeup Artist #6006', logo_url: null,
    embedVisible: false, expectName: 'Iloilo Makeup Artist #6006', expectRevealed: true,
  },
];

const F = {
  couple: '',
  otherCouple: '',
  stranger: '',
  eventId: '',
  otherEventId: '',
  shopUser: {} as Record<string, string>,
  shopId: {} as Record<string, string>,
  thread: {} as Record<string, string>,
};

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', false)`);
  await db.exec(`SET ROLE anon`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}
async function as<T>(uid: string | 'anon', fn: () => Promise<T>): Promise<T> {
  if (uid === 'anon') await asAnon();
  else await asUser(uid);
  try {
    return await fn();
  } finally {
    await reset();
  }
}

/** The page's read, as PostgREST runs it: the thread row + a correlated read of its shop, under the caller's RLS. */
async function embedAsCouple(uid: string, eventId: string): Promise<Map<string, { business_name: string } | null>> {
  return as(uid, async () => {
    const r = await db.query<{ thread_id: string; vendor: { business_name: string } | null }>(
      `SELECT t.thread_id,
              (SELECT to_jsonb(v) FROM (
                 SELECT p.business_name, p.logo_url, p.public_id, p.screen_name, p.name_revealed_at, p.services,
                        p.location_city, p.tier_state, p.verification_state
                 FROM public.vendor_profiles p WHERE p.vendor_profile_id = t.vendor_profile_id) v) AS vendor
         FROM public.chat_threads t WHERE t.event_id = $1`,
      [eventId],
    );
    return new Map(r.rows.map((row) => [row.thread_id, row.vendor]));
  });
}

async function namesAs(uid: string | 'anon', eventId: string): Promise<CoupleThreadSupplierRow[]> {
  return as(uid, async () =>
    (
      await db.query<CoupleThreadSupplierRow>(`SELECT * FROM public.couple_thread_supplier_names($1)`, [eventId])
    ).rows,
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('cn-couple@chat-names.test', 'customer');
  F.otherCouple = await mkUser('cn-other-couple@chat-names.test', 'customer');
  F.stranger = await mkUser('cn-stranger@chat-names.test', 'customer');

  const ev = async (name: string, couple: string) => {
    const id = (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
      id,
      couple,
    ]);
    return id;
  };
  F.eventId = await ev('Indalecio & Claire', F.couple);
  F.otherEventId = await ev('Somebody Else’s Wedding', F.otherCouple);

  for (const s of SHOPS) {
    const uid = await mkUser(`cn-shop-${s.key}@chat-names.test`, 'vendor');
    F.shopUser[s.key] = uid;
    const id = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
        [uid, s.business_name || 'placeholder'],
      )
    ).rows[0]!.vendor_profile_id;
    // The state is written AFTER the insert, as superuser with every trigger off: this seeds a state, it does not
    // exercise the paths that reach it (those have their own tests).
    await db.exec('SET session_replication_role = replica');
    await db.query(
      `UPDATE public.vendor_profiles SET
         business_name = $2, verification_state = $3::vendor_verification_state,
         public_visibility = $4::vendor_public_visibility, tier_state = $5::vendor_tier_state,
         services = $6::text[], location_city = $7, name_revealed_at = $8::timestamptz, screen_name = $9,
         logo_url = $10, is_demo = $11, last_verified_at = now()
       WHERE vendor_profile_id = $1`,
      [id, s.business_name, s.verification_state, s.public_visibility, s.tier_state, s.services, s.location_city,
        s.name_revealed_at, s.screen_name, s.logo_url, s.is_demo ?? false],
    );
    await db.exec('SET session_replication_role = origin');
    F.shopId[s.key] = id;
    F.thread[s.key] = (
      await db.query<{ thread_id: string }>(
        `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
         VALUES ($1, $2, $3, 'accepted'::chat_inquiry_status) RETURNING thread_id`,
        [F.eventId, id, F.couple],
      )
    ).rows[0]!.thread_id;
  }
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('the seed is what it says (read back as superuser, so a silent no-op cannot pass)', async () => {
  const r = await db.query<{ vendor_profile_id: string; verification_state: string; public_visibility: string; tier_state: string }>(
    `SELECT vendor_profile_id, verification_state::text, public_visibility::text, tier_state::text
       FROM public.vendor_profiles WHERE vendor_profile_id = ANY($1::uuid[])`,
    [Object.values(F.shopId)],
  );
  assert.equal(r.rows.length, SHOPS.length);
  for (const s of SHOPS) {
    const row = r.rows.find((x) => x.vendor_profile_id === F.shopId[s.key])!;
    assert.deepEqual(
      [row.verification_state, row.public_visibility, row.tier_state],
      [s.verification_state, s.public_visibility, s.tier_state],
      `${s.key} did not seed`,
    );
  }
});

test('THE CAUSE — the couple’s embed of the shop is NULL for every shop that is not public + verified', async () => {
  const embed = await embedAsCouple(F.couple, F.eventId);
  assert.equal(embed.size, SHOPS.length, 'the couple must list every thread — else this measures nothing');
  const nulls: string[] = [];
  for (const s of SHOPS) {
    const v = embed.get(F.thread[s.key]!);
    if (v == null) nulls.push(s.key);
    assert.equal(v != null, s.embedVisible, `${s.key}: embed visible = ${v != null}, expected ${s.embedVisible}`);
  }
  // The states that printed 'Supplier' — every one is a shop the couple can chat with but may not read.
  assert.deepEqual(nulls.sort(), SHOPS.filter((s) => !s.embedVisible).map((s) => s.key).sort());
  assert.ok(nulls.includes('free-unverified-coming-soon'), 'the plain new free shop is the headline case');
});

test('THE FIX — every thread has a row and the label the anonymity resolver gives, per shop state', async () => {
  const rows = await namesAs(F.couple, F.eventId);
  assert.equal(rows.length, SHOPS.length, 'one row per thread — a missing row would print the unreadable line');
  for (const s of SHOPS) {
    const row = rows.find((r) => r.thread_id === F.thread[s.key]);
    assert.ok(row, `${s.key}: no row`);
    const label = threadSupplierName(row);
    assert.equal(label.name, s.expectName, `${s.key}: printed "${label.name}"`);
    assert.equal(label.revealed, s.expectRevealed, `${s.key}: revealed`);
    assert.equal(label.readable, true);
    assert.notEqual(label.name.trim().toLowerCase(), 'supplier', `${s.key}: the bare word is not a name`);
  }
});

test('ANONYMITY — an unrevealed shop’s business name and logo never leave the database', async () => {
  const rows = await namesAs(F.couple, F.eventId);
  const hidden = SHOPS.filter((s) => !s.expectRevealed);
  assert.ok(hidden.length >= 2, 'needs unrevealed shops to mean anything');
  for (const s of hidden) {
    const row = rows.find((r) => r.thread_id === F.thread[s.key])!;
    assert.equal(row.name_revealed, false, s.key);
    assert.equal(row.business_name, null, `${s.key}: business name leaked pre-reveal`);
    assert.equal(row.logo_url, null, `${s.key}: logo leaked pre-reveal`);
    assert.ok(!JSON.stringify(row).includes(s.business_name), `${s.key}: the real name is somewhere in the row`);
  }
  // Positive control: a revealed shop with a logo DOES carry it — so the NULLs above are the rule, not a bug.
  const open = rows.find((r) => r.thread_id === F.thread['unverified-paid-tier'])!;
  assert.equal(open.business_name, 'Solo Cakes');
  assert.equal(open.logo_url, 'logos/solo.webp');
});

test('THE GATE — a stranger, the supplier, another couple and anon get nothing', async () => {
  assert.equal((await namesAs(F.stranger, F.eventId)).length, 0, 'stranger');
  assert.equal((await namesAs(F.shopUser['free-unverified-coming-soon']!, F.eventId)).length, 0, 'the supplier');
  assert.equal((await namesAs(F.otherCouple, F.eventId)).length, 0, 'another couple');
  assert.equal((await namesAs(F.otherCouple, F.otherEventId)).length, 0, 'their own event has no threads');
  await assert.rejects(namesAs('anon', F.eventId), /permission denied/i, 'anon must hold no EXECUTE');
  // Positive control on the gate: the couple does get rows (the zeros above are the gate, not an empty event).
  assert.equal((await namesAs(F.couple, F.eventId)).length, SHOPS.length);
});

test('THE GRANTS — EXECUTE for authenticated only; SECURITY DEFINER with a pinned search_path', async () => {
  const r = await db.query<{ anon: boolean; authed: boolean; pub: boolean; secdef: boolean; cfg: string[] | null }>(
    `SELECT has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed,
            EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                     WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS pub,
            p.prosecdef AS secdef, p.proconfig AS cfg
       FROM pg_proc p WHERE p.proname = 'couple_thread_supplier_names' AND p.pronamespace = 'public'::regnamespace`,
  );
  assert.equal(r.rows.length, 1);
  const f = r.rows[0]!;
  assert.deepEqual([f.anon, f.authed, f.pub, f.secdef], [false, true, false, true]);
  assert.ok((f.cfg ?? []).some((c) => c.startsWith('search_path=')), 'search_path must be pinned');
});

test('PARITY — the SQL reveal predicate equals isVendorNameRevealed for every tier × verification × venue × stamp', async () => {
  const tiers = (await db.query<{ v: string }>(`SELECT unnest(enum_range(NULL::vendor_tier_state))::text AS v`)).rows.map((r) => r.v);
  const states = (await db.query<{ v: string }>(`SELECT unnest(enum_range(NULL::vendor_verification_state))::text AS v`)).rows.map((r) => r.v);
  assert.ok(tiers.length >= 6 && states.length >= 5, `enums read: ${tiers} / ${states}`);
  const probe = F.shopId['free-unverified-coming-soon']!;
  let compared = 0;
  for (const tier of tiers) {
    for (const vs of states) {
      for (const services of [['florist'], ['religious_venue'], ['catering', 'venue']]) {
        for (const stamped of [null, '2026-10-01T00:00:00Z']) {
          await db.exec('SET session_replication_role = replica');
          await db.query(
            `UPDATE public.vendor_profiles SET tier_state = $2::vendor_tier_state,
               verification_state = $3::vendor_verification_state, services = $4::text[], name_revealed_at = $5::timestamptz,
               last_verified_at = now()
             WHERE vendor_profile_id = $1`,
            [probe, tier, vs, services, stamped],
          );
          await db.exec('SET session_replication_role = origin');
          const row = (await namesAs(F.couple, F.eventId)).find((r) => r.vendor_profile_id === probe)!;
          const ts = isVendorNameRevealed({
            name_revealed_at: stamped,
            isPaidTier: isTrueNameTier(tier),
            is_verified: vs === 'verified',
            services,
          });
          assert.equal(row.name_revealed, ts, `tier=${tier} state=${vs} services=${services} stamped=${stamped}: SQL ${row.name_revealed} ≠ TS ${ts}`);
          compared += 1;
        }
      }
    }
  }
  assert.equal(compared, tiers.length * states.length * 3 * 2);
});
