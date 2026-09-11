/**
 * A SHOP'S EMAIL AND PHONE ARE NOT ONE POSTGREST CALL AWAY — migration
 * 20271221366210, proven as REAL `anon` and `authenticated` sessions (SET ROLE +
 * JWT claims), never as the superuser the replay otherwise runs as.
 *
 * Owner, 2026-09-10: "our goal is to let them integrate their event with the
 * vendor they find. not to let them communicate outside the app."
 *
 * Before: anon held SELECT(contact_email), authenticated held SELECT on both,
 * and `vendor_market_stats` (security_invoker, public) projected contact_email.
 *
 * 🔑 EVERY REFUSAL HAS A POSITIVE CONTROL AND A NEUTRALISATION. The same stranger
 * reads the shop's NAME off the same row (so RLS admits the row and a refusal is
 * about the column); and inside a rolled-back transaction the two grants are
 * handed back and the same read is shown to LAND (so "permission denied" is the
 * grant, not something unrelated).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const EMAIL = 'bookings@saysay-band.test';
const PHONE = '+639171234567';

const W = { shopOwner: '', teammate: '', stranger: '', vendorProfileId: '' };

async function mkUser(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function asAuthenticated(uid: string | null): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['authenticated']);
  await setAuthUid(db, uid);
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['anon']);
  await setAuthUid(db, null);
  await db.exec(`SET ROLE anon`);
}
async function asService(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['service_role']);
  await db.exec(`SET ROLE service_role`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, ['']);
  await setAuthUid(db, null);
}
async function tryQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<{ err: string | null; rows: T[] }> {
  try {
    const r = await db.query<T>(sql, params);
    return { err: null, rows: r.rows };
  } catch (e) {
    return { err: (e as Error).message ?? String(e), rows: [] };
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  W.shopOwner = await mkUser(`contact-owner-${Date.now()}@example.test`, 'vendor');
  W.teammate = await mkUser(`contact-mate-${Date.now()}@example.test`, 'customer');
  W.stranger = await mkUser(`contact-stranger-${Date.now()}@example.test`, 'customer');
  // The vendor signup trigger auto-creates the shop row (user_id is UNIQUE), so
  // promote it to the exact shape vendor_profiles_public_read admits.
  const v = await db.query<{ vendor_profile_id: string }>(
    `UPDATE public.vendor_profiles
        SET business_name = 'Saysay Live Band', public_visibility = 'verified',
            verification_state = 'verified', last_verified_at = NOW(),
            contact_email = $2, contact_phone = $3
      WHERE user_id = $1 RETURNING vendor_profile_id`,
    [W.shopOwner, EMAIL, PHONE],
  );
  assert.equal(v.rows.length, 1, 'the vendor signup did not auto-create exactly one shop row');
  W.vendorProfileId = v.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'viewer')`,
    [W.vendorProfileId, W.teammate],
  );
});

after(async () => {
  if (!db) return;
  await reset();
  await db.close?.();
});

/* ── 0 · META ─────────────────────────────────────────────────────────────── */

test('META: each probing role is itself — not the owner, not super, no BYPASSRLS', async () => {
  for (const [label, enter] of [
    ['authenticated', () => asAuthenticated(W.stranger)],
    ['anon', asAnon],
  ] as const) {
    await enter();
    const r = await db.query<{ me: string; owner: string; bypass: boolean; sup: boolean }>(
      `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS sup
         FROM pg_class c WHERE c.oid = 'public.vendor_profiles'::regclass`,
    );
    await reset();
    assert.equal(r.rows[0]!.me, label, 'SET ROLE did not take');
    assert.notEqual(r.rows[0]!.owner, label, `${label} OWNS vendor_profiles`);
    assert.equal(r.rows[0]!.bypass, false, `${label} has BYPASSRLS`);
    assert.equal(r.rows[0]!.sup, false, `${label} is a superuser`);
  }
});

test('META: RLS really admits this shop to a stranger and to anon — so a refusal below is about the COLUMN', async () => {
  for (const enter of [() => asAuthenticated(W.stranger), asAnon]) {
    await enter();
    const r = await tryQuery<{ business_name: string }>(
      `SELECT business_name FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
      [W.vendorProfileId],
    );
    await reset();
    assert.equal(r.err, null, `the positive control itself failed: ${r.err}`);
    assert.equal(r.rows.length, 1, 'zero rows — every refusal below would then prove nothing');
    assert.equal(r.rows[0]!.business_name, 'Saysay Live Band');
  }
});

/* ── 1 · THE DOOR IS SHUT ─────────────────────────────────────────────────── */

const READS: Array<[string, string]> = [
  ['email', `SELECT contact_email FROM public.vendor_profiles WHERE vendor_profile_id = $1`],
  ['phone', `SELECT contact_phone FROM public.vendor_profiles WHERE vendor_profile_id = $1`],
  ['wildcard', `SELECT * FROM public.vendor_profiles WHERE vendor_profile_id = $1`],
  // The oracle shapes: a column the caller may not SELECT may not be filtered,
  // sorted or aggregated on either.
  ['filter', `SELECT vendor_profile_id FROM public.vendor_profiles WHERE vendor_profile_id = $1 AND contact_email ILIKE 'b%'`],
  ['order', `SELECT vendor_profile_id FROM public.vendor_profiles WHERE vendor_profile_id = $1 ORDER BY contact_phone`],
  ['aggregate', `SELECT count(contact_email) FROM public.vendor_profiles WHERE vendor_profile_id = $1`],
];

test('a signed-in STRANGER cannot read, filter, sort or count on a shop’s email or phone', async () => {
  let refused = 0;
  for (const [name, sql] of READS) {
    await asAuthenticated(W.stranger);
    const r = await tryQuery(sql, [W.vendorProfileId]);
    await reset();
    assert.ok(r.err, `authenticated ${name} read LANDED: ${JSON.stringify(r.rows)}`);
    assert.match(r.err, /permission denied/i, `${name} refused for the wrong reason: ${r.err}`);
    refused += 1;
  }
  console.log(`# authenticated contact reads refused: ${refused}/${READS.length}`);
  assert.equal(refused, READS.length);
});

test('ANON (the public key) cannot read, filter, sort or count on them either', async () => {
  let refused = 0;
  for (const [name, sql] of READS) {
    await asAnon();
    const r = await tryQuery(sql, [W.vendorProfileId]);
    await reset();
    assert.ok(r.err, `anon ${name} read LANDED: ${JSON.stringify(r.rows)}`);
    assert.match(r.err, /permission denied/i, `${name} refused for the wrong reason: ${r.err}`);
    refused += 1;
  }
  console.log(`# anon contact reads refused: ${refused}/${READS.length}`);
  assert.equal(refused, READS.length);
});

test('NEUTRALISATION: hand the grants back (rolled back) and the same stranger read LANDS', async () => {
  await db.exec('BEGIN');
  let got: { err: string | null; rows: Array<{ contact_email: string; contact_phone: string }> };
  try {
    await db.exec(`GRANT SELECT (contact_email, contact_phone) ON public.vendor_profiles TO authenticated`);
    await asAuthenticated(W.stranger);
    got = await tryQuery(
      `SELECT contact_email, contact_phone FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
      [W.vendorProfileId],
    );
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
  assert.equal(got.err, null, `even with the grant the read failed (${got.err}) — the refusals above are not about the grant`);
  assert.equal(got.rows[0]?.contact_email, EMAIL, 'with the grant the stranger did not get the email — the fixture is wrong');
  // …and the rollback really took the grant away again.
  await asAuthenticated(W.stranger);
  const after = await tryQuery(`SELECT contact_email FROM public.vendor_profiles`);
  await reset();
  assert.ok(after.err, 'the neutralisation leaked: the grant survived its ROLLBACK');
});

test('the marketplace view no longer carries the email — and still serves anon and a stranger', async () => {
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_market_stats'`,
  );
  const names = cols.rows.map((r) => r.column_name);
  assert.ok(names.length >= 25, `vendor_market_stats has only ${names.length} columns — it was not rebuilt whole`);
  assert.ok(!names.includes('contact_email') && !names.includes('contact_phone'), 'vendor_market_stats still projects a contact column');
  for (const keep of ['business_name', 'ad_rank', 'is_setnayan_service', 'hq_region', 'tier_state', 'verification_state']) {
    assert.ok(names.includes(keep), `the rebuilt view lost ${keep}`);
  }
  const opts = await db.query<{ opts: string[] | null }>(
    `SELECT reloptions AS opts FROM pg_class WHERE oid = 'public.vendor_market_stats'::regclass`,
  );
  assert.ok((opts.rows[0]!.opts ?? []).includes('security_invoker=true'), 'the rebuilt view is not security_invoker');

  for (const enter of [asAnon, () => asAuthenticated(W.stranger)]) {
    await enter();
    const all = await tryQuery<{ business_name: string }>(
      `SELECT * FROM public.vendor_market_stats WHERE vendor_profile_id = $1`,
      [W.vendorProfileId],
    );
    const email = await tryQuery(`SELECT contact_email FROM public.vendor_market_stats`);
    await reset();
    assert.equal(all.err, null, `the marketplace view broke for a browser: ${all.err}`);
    assert.equal(all.rows.length, 1, 'the verified shop is missing from the marketplace view');
    assert.ok(email.err && /does not exist/i.test(email.err), `contact_email is still reachable on the view: ${email.err ?? 'LANDED'}`);
  }
});

/* ── 2 · WHAT MUST KEEP WORKING ───────────────────────────────────────────── */

test('the SHOP reads its own email and phone through vendor_profiles_self (My Shop still shows them)', async () => {
  await asAuthenticated(W.shopOwner);
  const r = await tryQuery<{ contact_email: string; contact_phone: string }>(
    `SELECT contact_email, contact_phone FROM public.vendor_profiles_self WHERE user_id = $1`,
    [W.shopOwner],
  );
  await reset();
  assert.equal(r.err, null, `the shop cannot read its own contact details: ${r.err}`);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.contact_email, EMAIL);
  assert.equal(r.rows[0]!.contact_phone, PHONE);
});

test('a TEAM MEMBER reads them too; a STRANGER reads zero rows from the self view', async () => {
  await asAuthenticated(W.teammate);
  const mate = await tryQuery<{ contact_email: string }>(
    `SELECT contact_email FROM public.vendor_profiles_self WHERE vendor_profile_id = $1`,
    [W.vendorProfileId],
  );
  await reset();
  assert.equal(mate.err, null, mate.err ?? '');
  assert.equal(mate.rows[0]?.contact_email, EMAIL, 'a teammate lost the shop’s contact email');

  await asAuthenticated(W.stranger);
  const s = await tryQuery(`SELECT contact_email FROM public.vendor_profiles_self`);
  await reset();
  assert.equal(s.err, null, s.err ?? '');
  assert.equal(s.rows.length, 0, 'the definer view hands a stranger somebody else’s shop');
});

test('WRITES SURVIVE: the shop updates its own email and phone on its own session', async () => {
  await db.exec('BEGIN');
  try {
    await asAuthenticated(W.shopOwner);
    await db.query(
      `UPDATE public.vendor_profiles SET contact_email = 'new@saysay-band.test', contact_phone = '+639170000000'
        WHERE vendor_profile_id = $1`,
      [W.vendorProfileId],
    );
    const back = await db.query<{ contact_email: string; contact_phone: string }>(
      `SELECT contact_email, contact_phone FROM public.vendor_profiles_self WHERE vendor_profile_id = $1`,
      [W.vendorProfileId],
    );
    assert.equal(back.rows[0]!.contact_email, 'new@saysay-band.test');
    assert.equal(back.rows[0]!.contact_phone, '+639170000000');
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
});

test('service_role (every admin surface, the export, the claim flow) still reads both', async () => {
  await asService();
  const r = await tryQuery<{ contact_email: string; contact_phone: string }>(
    `SELECT contact_email, contact_phone FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [W.vendorProfileId],
  );
  await reset();
  assert.equal(r.err, null, r.err ?? '');
  assert.equal(r.rows[0]!.contact_email, EMAIL);
});

test('the catalogue agrees: neither browser role holds SELECT on either column; UPDATE is kept', async () => {
  const r = await db.query<{ role: string; col: string; sel: boolean; upd: boolean }>(
    `SELECT r AS role, c AS col,
            has_column_privilege(r, 'public.vendor_profiles', c, 'SELECT') AS sel,
            has_column_privilege(r, 'public.vendor_profiles', c, 'UPDATE') AS upd
       FROM unnest(ARRAY['anon','authenticated']) r, unnest(ARRAY['contact_email','contact_phone']) c`,
  );
  assert.equal(r.rows.length, 4);
  for (const row of r.rows) {
    assert.equal(row.sel, false, `${row.role} still holds SELECT on ${row.col}`);
    if (row.role === 'authenticated') assert.equal(row.upd, true, `authenticated lost UPDATE on ${row.col} — the shop editor breaks`);
  }
  const tbl = await db.query<{ a: boolean; b: boolean }>(
    `SELECT has_table_privilege('anon','public.vendor_profiles','SELECT') a,
            has_table_privilege('authenticated','public.vendor_profiles','SELECT') b`,
  );
  assert.equal(tbl.rows[0]!.a, false, 'anon holds TABLE-level SELECT — the column revoke is inert');
  assert.equal(tbl.rows[0]!.b, false, 'authenticated holds TABLE-level SELECT — the column revoke is inert');
});
