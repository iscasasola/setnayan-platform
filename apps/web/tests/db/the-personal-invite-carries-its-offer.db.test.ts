/**
 * THE PERSONAL INVITE CARRIES ITS OFFER — walked in SQL, the way the app takes it.
 *
 * Owner 2026-10-23 (prototype `supplier_personal_invite_2026-10-23.html`): the admin's invite offers a plan free
 * until a date and, optionally, 100 portfolio photos — and the 100 are KEPT after the offer ends.
 *
 *   1. The admin makes the invite   — service role stages a hidden, unowned shop + the `vendor_invites` row with
 *                                     the offer (`createAdminVendorInvite`).
 *   2. The supplier signs up        — `/signup?as=vendor`: the triggers open an EMPTY shop the same instant.
 *   3. Finalize                     — `claim_ready_the_invited_shop` (this migration), then the invite is marked
 *                                     claimed.
 *
 * 🔑 The first test proves the trap is real (step 2 really opens an empty shop), so this file cannot pass in a world
 * where the staged row was simply transferred.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function asUser(uid: string): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

async function signUp(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

type Offer = { tier?: 'solo' | 'pro' | 'enterprise' | null; untilDays?: number | null; photos?: number | null };

/** Step 1 — `createAdminVendorInvite`, statement for statement (service role). */
async function adminInvites(adminUid: string, business: string, category: string | null, offer: Offer = {}) {
  await asOwner();
  const email = `invite-${++n}@example.ph`;
  const staged = await db.query<{ id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, created_by_admin_user_id, business_name, contact_email, services, is_published, public_visibility)
     VALUES (NULL, $1, $2, $3, $4::text[], FALSE, 'hidden') RETURNING vendor_profile_id AS id`,
    [adminUid, business, email, category ? [category] : []],
  );
  const token = `personal-invite-${n}-${Math.random().toString(36).slice(2)}`;
  await db.query(
    `INSERT INTO public.vendor_invites
       (vendor_id, invited_by_user_id, email, business_name, service_category, claim_token, status, source,
        expires_at, claimed_vendor_profile_id, offer_tier, offer_until, offer_photo_allowance)
     VALUES (NULL, $1, $2, $3, $4, $5, 'pending', 'admin', now() + interval '90 days', $6,
             $7, CASE WHEN $8::int IS NULL THEN NULL ELSE now() + make_interval(days => $8::int) END, $9)`,
    [adminUid, email, business, category, token, staged.rows[0]!.id, offer.tier ?? null, offer.untilDays ?? null, offer.photos ?? null],
  );
  return { token, email, stagedId: staged.rows[0]!.id };
}

/** Step 3 — the finalize page's admin branch: ONE call, which also spends the link (nothing is written after it). */
async function finalize(uid: string, token: string): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(`SELECT public.claim_ready_the_invited_shop($1, $2) AS id`, [uid, token]);
  return r.rows[0]!.id;
}

async function giftLogCount(shop: string): Promise<number> {
  await asOwner();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.admin_audit_log WHERE action = 'vendor_tier_set' AND target_id::text = $1`,
    [shop],
  );
  return r.rows[0]!.n;
}

async function shopOf(id: string) {
  await asOwner();
  const r = await db.query<{
    user_id: string | null;
    business_name: string | null;
    services: string[];
    contact_email: string | null;
    tier_state: string;
    tier_expires_at: string | null;
    tier_source: string | null;
    portfolio_photo_allowance: number | null;
  }>(
    `SELECT user_id, business_name, services, contact_email, tier_state::text AS tier_state, tier_expires_at,
            tier_source::text AS tier_source, portfolio_photo_allowance
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

let adminUid: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  adminUid = await signUp('ops@setnayan.test', 'customer');
});
after(async () => {
  await db?.close();
});

test('the trap is real: a vendor sign-up opens an empty shop before finalize runs', async () => {
  const uid = await signUp('trap@example.ph', 'vendor');
  await asOwner();
  const r = await db.query<{ business_name: string | null }>(
    `SELECT business_name FROM public.vendor_profiles WHERE user_id = $1`,
    [uid],
  );
  assert.equal(r.rows.length, 1, 'no empty shop was opened at sign-up — the fixture no longer models the trap');
  assert.equal(r.rows[0]!.business_name || null, null, 'the sign-up shop already has a name');
});

test('the usual case: the empty sign-up shop is deleted and the PREPARED shop is handed over whole — gift tier, founder, published and all', async () => {
  const { token, email, stagedId } = await adminInvites(adminUid, 'Tita Nena’s Catering', 'caterer');
  // What an admin can set on the prepared shop before the claim (setVendorTier, the founder flag, publishing).
  await asOwner();
  await db.query(
    `UPDATE public.vendor_profiles SET tier_state = 'pro', tier_expires_at = now() + interval '40 days',
       is_founder = TRUE, is_published = TRUE WHERE vendor_profile_id = $1`,
    [stagedId],
  );
  const uid = await signUp(email, 'vendor');
  await asOwner();
  const empty = await db.query<{ id: string }>(`SELECT vendor_profile_id AS id FROM public.vendor_profiles WHERE user_id = $1`, [uid]);
  const shop = await finalize(uid, token);
  assert.equal(shop, stagedId, 'the prepared shop was not the one handed over');
  assert.equal(await shopOf(empty.rows[0]!.id), null, 'the empty sign-up shop was left behind');
  const row = await shopOf(shop);
  assert.equal(row?.user_id, uid);
  assert.equal(row?.business_name, 'Tita Nena’s Catering');
  assert.deepEqual(row?.services, ['caterer']);
  assert.equal(row?.contact_email, email);
  assert.equal(row?.tier_state, 'pro', 'the prepared gift tier was lost');
  await asOwner();
  const flags = await db.query<{ f: boolean; p: boolean }>(
    `SELECT is_founder AS f, is_published AS p FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop],
  );
  assert.equal(flags.rows[0]!.f, true, 'the founder flag was lost');
  assert.equal(flags.rows[0]!.p, true, 'is_published was lost');
  const inv = await db.query<{ c: string }>(`SELECT claimed_vendor_profile_id AS c FROM public.vendor_invites WHERE claim_token = $1`, [token]);
  assert.equal(inv.rows[0]!.c, shop);
  const seat = await db.query(`SELECT 1 FROM public.vendor_team_members WHERE vendor_profile_id = $1 AND user_id = $2 AND role = 'admin'`, [shop, uid]);
  assert.equal(seat.rows.length, 1, 'the claimant has no admin seat');
});

test('a REAL existing shop is kept, never deleted: blanks filled, and the prepared founder · published · gift tier · allowance copied', async () => {
  const { token, email, stagedId } = await adminInvites(adminUid, 'Bakeshop Prepared', 'cake', { photos: 100 });
  await asOwner();
  await db.query(
    `UPDATE public.vendor_profiles SET tier_state = 'solo', tier_expires_at = now() + interval '20 days',
       is_founder = TRUE, is_published = TRUE WHERE vendor_profile_id = $1`,
    [stagedId],
  );
  const uid = await signUp(email, 'vendor');
  await asOwner();
  const own = await db.query<{ id: string }>(`SELECT vendor_profile_id AS id FROM public.vendor_profiles WHERE user_id = $1`, [uid]);
  // Something of the supplier's: a name they typed. The shop is real now and must survive.
  await db.query(`UPDATE public.vendor_profiles SET business_name = 'Her Own Bakeshop' WHERE vendor_profile_id = $1`, [own.rows[0]!.id]);
  const shop = await finalize(uid, token);
  assert.equal(shop, own.rows[0]!.id, 'the supplier\'s own shop was replaced');
  assert.equal(await shopOf(stagedId), null, 'the prepared row was left behind');
  const row = await shopOf(shop);
  assert.equal(row?.business_name, 'Her Own Bakeshop', 'a name the supplier set was overwritten');
  assert.deepEqual(row?.services, ['cake'], 'a blank service was not filled');
  assert.equal(row?.tier_state, 'solo', 'the prepared gift tier was not copied onto a Free shop');
  assert.equal(row?.portfolio_photo_allowance, 100);
  await asOwner();
  const flags = await db.query<{ f: boolean; p: boolean }>(
    `SELECT is_founder AS f, is_published AS p FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop],
  );
  assert.equal(flags.rows[0]!.f, true, 'the founder flag was not copied');
  assert.equal(flags.rows[0]!.p, true, 'is_published was not copied');
});

test('a shop with anything pointing at it is not "empty": a team mate on the sign-up shop keeps it from being deleted', async () => {
  const { token, email, stagedId } = await adminInvites(adminUid, 'Crewed Shop', 'photographer');
  const uid = await signUp(email, 'vendor');
  const mate = await signUp('mate@example.ph', 'customer');
  await asOwner();
  const own = await db.query<{ id: string }>(`SELECT vendor_profile_id AS id FROM public.vendor_profiles WHERE user_id = $1`, [uid]);
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'viewer')`, [own.rows[0]!.id, mate]);
  const shop = await finalize(uid, token);
  assert.equal(shop, own.rows[0]!.id, 'a shop with a team mate was deleted');
  assert.equal(await shopOf(stagedId), null);
  assert.equal((await shopOf(shop))?.business_name, 'Crewed Shop', 'the blank name was not filled from the prepared shop');
});

test('a link past its expires_at claims nothing, whatever the page did', async () => {
  const { token, email } = await adminInvites(adminUid, 'Too Late Co', 'florist', { tier: 'pro', untilDays: 30 });
  await asOwner();
  await db.query(`UPDATE public.vendor_invites SET expires_at = now() - interval '1 minute' WHERE claim_token = $1`, [token]);
  const uid = await signUp(email, 'vendor');
  await asOwner();
  await assert.rejects(db.query(`SELECT public.claim_ready_the_invited_shop($1, $2)`, [uid, token]), /this link has expired/);
  await asOwner();
  const r = await db.query<{ t: string }>(`SELECT tier_state::text AS t FROM public.vendor_profiles WHERE user_id = $1`, [uid]);
  assert.equal(r.rows[0]!.t, 'free');
});

test('a plan gift runs a year at most from the day it is offered', async () => {
  await asOwner();
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_invites (vendor_id, email, business_name, claim_token, status, source, expires_at, offer_tier, offer_until)
       VALUES (NULL, 'long@example.ph', 'Long Gift', 'too-long-1', 'pending', 'admin', now() + interval '9 days', 'pro', now() + interval '400 days')`,
    ),
    /vendor_invites_offer_until_within_a_year/,
  );
  // A full year from today (the form's last day, stored as its end-of-day instant) is allowed.
  await db.query(
    `INSERT INTO public.vendor_invites (vendor_id, email, business_name, claim_token, status, source, expires_at, offer_tier, offer_until)
     VALUES (NULL, 'year@example.ph', 'Year Gift', 'a-year-1', 'pending', 'admin', now() + interval '9 days', 'pro', now() + interval '1 year' + interval '12 hours')`,
  );
});

test('no shop yet (a sign-up that arrived as a customer): the staged row itself is handed over', async () => {
  const { token, email, stagedId } = await adminInvites(adminUid, 'Lights by Ben', 'lights_sound');
  const uid = await signUp(email, 'customer');
  const shop = await finalize(uid, token);
  assert.equal(shop, stagedId);
  assert.equal((await shopOf(shop))?.user_id, uid);
});

test('the offer: Pro until the date, written as an admin comp with one audit line naming the invite', async () => {
  const { token, email } = await adminInvites(adminUid, 'Studio Uno', 'photographer', { tier: 'pro', untilDays: 90 });
  const uid = await signUp(email, 'vendor');
  const shop = await finalize(uid, token);
  const row = await shopOf(shop);
  assert.equal(row?.tier_state, 'pro');
  assert.equal(row?.tier_source, 'admin_comp');
  assert.ok(row?.tier_expires_at && Date.parse(row.tier_expires_at) > Date.now() + 80 * 86_400_000);
  assert.equal(row?.portfolio_photo_allowance, null, 'photos were given although the switch was off');
  const pub = await db.query<{ p: string }>(`SELECT public_id AS p FROM public.vendor_invites WHERE claim_token = $1`, [token]);
  const log = await db.query<{ reason: string; actor: string; to_tier: string }>(
    `SELECT metadata->>'reason' AS reason, actor_user_id::text AS actor, metadata->>'to_tier' AS to_tier
       FROM public.admin_audit_log WHERE action = 'vendor_tier_set' AND target_id::text = $1`,
    [shop],
  );
  assert.equal(log.rows.length, 1);
  assert.equal(log.rows[0]!.reason, `Personal invite ${pub.rows[0]!.p}`);
  assert.equal(log.rows[0]!.actor, adminUid);
  assert.equal(log.rows[0]!.to_tier, 'pro');
});

test('the 100 photos: written on claim, and still there after the plan gift has ended', async () => {
  const { token, email } = await adminInvites(adminUid, 'Bloom & Co', 'florist', { tier: 'solo', untilDays: 30, photos: 100 });
  const uid = await signUp(email, 'vendor');
  const shop = await finalize(uid, token);
  assert.equal((await shopOf(shop))?.portfolio_photo_allowance, 100);
  // The gift runs out: its day passes and the SHIPPED lapse (`sweep_vendor_tier_expiry`, login-driven) writes the
  // shop back to Free. The allowance is not the plan's, so it stays.
  await asOwner();
  await db.query(`UPDATE public.vendor_profiles SET tier_expires_at = now() - interval '1 minute' WHERE vendor_profile_id = $1`, [shop]);
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [shop]);
  const after = await shopOf(shop);
  assert.equal(after?.tier_state, 'free', 'the lapse did not run — the fixture no longer models the gift ending');
  assert.equal(after?.portfolio_photo_allowance, 100, 'the photos ended with the plan');
});

test('a shop on a plan is never touched: its term is not shortened, its credit is not put at risk, no gift is logged', async () => {
  // A paying Solo shop with most of a year left and a carried credit, offered Pro for 30 days. Writing the gift
  // would have cut the paid year to 30 days, and the gift's own lapse would have zeroed the credit.
  const a = await adminInvites(adminUid, 'Grand Hall', 'reception', { tier: 'pro', untilDays: 30 });
  const uidA = await signUp(a.email, 'vendor');
  await asOwner();
  const own = await db.query<{ id: string }>(`SELECT vendor_profile_id AS id FROM public.vendor_profiles WHERE user_id = $1`, [uidA]);
  const paidUntil = new Date(Date.now() + 300 * 86_400_000).toISOString();
  await db.query(
    `UPDATE public.vendor_profiles SET business_name = 'Grand Hall Events', tier_state = 'solo', tier_expires_at = $2,
       subscription_credit_php = 750 WHERE vendor_profile_id = $1`,
    [own.rows[0]!.id, paidUntil],
  );
  const before = await db.query<{ s: string | null }>(
    `SELECT tier_source AS s FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [own.rows[0]!.id],
  );
  const shopA = await finalize(uidA, a.token);
  await asOwner();
  const rowA = await db.query<{ t: string; e: string; c: string; s: string | null; n: string }>(
    `SELECT tier_state::text AS t, tier_expires_at::text AS e, subscription_credit_php::text AS c, tier_source AS s,
            business_name AS n FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shopA],
  );
  assert.equal(rowA.rows[0]!.t, 'solo', 'the paid plan was replaced by the gift');
  assert.equal(Date.parse(rowA.rows[0]!.e), Date.parse(paidUntil), 'the paid term was shortened to the gift day');
  assert.equal(Number(rowA.rows[0]!.c), 750, 'the carried credit moved');
  assert.equal(rowA.rows[0]!.s, before.rows[0]!.s, 'the claim relabelled the plan\'s source');
  assert.equal(rowA.rows[0]!.n, 'Grand Hall Events', 'a name the supplier set was overwritten');
  assert.equal(await giftLogCount(shopA), 0, 'a gift was logged that was never given');

  // An Ultra shop is left on Ultra; a plan past its day that the sweep has not reached yet is not overwritten either.
  for (const [name, tier, interval] of [
    ['Ultra Hall', 'enterprise', "60 days"],
    ['Lapsed Lights', 'pro', "-2 days"],
  ] as const) {
    const inv = await adminInvites(adminUid, name, 'lights_sound', { tier: 'solo', untilDays: 30 });
    const u = await signUp(inv.email, 'vendor');
    await asOwner();
    await db.query(
      `UPDATE public.vendor_profiles SET tier_state = $2::public.vendor_tier_state, tier_expires_at = now() + $3::interval
        WHERE user_id = $1`,
      [u, tier, interval],
    );
    const shop = await finalize(u, inv.token);
    assert.equal((await shopOf(shop))?.tier_state, tier, `${name}: the gift was written over a plan`);
    assert.equal(await giftLogCount(shop), 0);
  }

  // A gift already past its date grants nothing, even to a Free shop.
  const b = await adminInvites(adminUid, 'Late Claim', 'cake', { tier: 'pro', untilDays: 1 });
  await asOwner();
  await db.query(`UPDATE public.vendor_invites SET offer_until = now() - interval '1 day' WHERE claim_token = $1`, [b.token]);
  const uidB = await signUp(b.email, 'vendor');
  const shopB = await finalize(uidB, b.token);
  assert.equal((await shopOf(shopB))?.tier_state, 'free');
});

test('a link is spent once: the claim itself marks it claimed; a second person is refused; the same person again gets their shop and nothing twice', async () => {
  const { token, email } = await adminInvites(adminUid, 'Shared Link Co', 'caterer', { tier: 'pro', untilDays: 60, photos: 100 });
  const first = await signUp(email, 'vendor');
  const shop = await finalize(first, token);
  await asOwner();
  const inv = await db.query<{ status: string; by: string; shop: string; at: string | null }>(
    `SELECT status::text AS status, claimed_by_user_id::text AS by, claimed_vendor_profile_id::text AS shop,
            claimed_at::text AS at FROM public.vendor_invites WHERE claim_token = $1`,
    [token],
  );
  assert.equal(inv.rows[0]!.status, 'claimed', 'the call left the link pending — a second person could still use it');
  assert.equal(inv.rows[0]!.by, first);
  assert.equal(inv.rows[0]!.shop, shop);
  assert.ok(inv.rows[0]!.at);

  // Someone the link was forwarded to.
  const second = await signUp('forwarded@example.ph', 'vendor');
  await asOwner();
  await assert.rejects(
    db.query(`SELECT public.claim_ready_the_invited_shop($1, $2)`, [second, token]),
    /this link is claimed/,
  );
  await asOwner();
  const secondShop = await db.query<{ t: string }>(
    `SELECT tier_state::text AS t FROM public.vendor_profiles WHERE user_id = $1`,
    [second],
  );
  assert.equal(secondShop.rows[0]?.t, 'free', 'the forwarded link handed out the gift a second time');

  // The first supplier tapping twice (or refreshing): their shop back, the gift logged once.
  assert.equal(await finalize(first, token), shop);
  assert.equal(await giftLogCount(shop), 1, 'a retry applied the gift twice');
});

test('the invite refuses what it cannot carry: a couple-made offer, a plan with no end, a non-admin claim', async () => {
  await asOwner();
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_invites (vendor_id, email, business_name, claim_token, status, source, expires_at, offer_tier, offer_until)
       VALUES (NULL, 'x@example.ph', 'X', 'bad-1', 'pending', 'admin', now() + interval '9 days', 'pro', NULL)`,
    ),
    /vendor_invites_offer_tier_has_an_end/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_invites (vendor_id, email, business_name, claim_token, status, source, expires_at, offer_tier, offer_until)
       VALUES (NULL, 'x@example.ph', 'X', 'bad-2', 'pending', 'admin', now() + interval '9 days', 'verified', now() + interval '9 days')`,
    ),
    /vendor_invites_offer_tier_is_a_paid_plan/,
  );
  const uid = await signUp('nobody@example.ph', 'vendor');
  await asUser(uid);
  await assert.rejects(db.query(`SELECT public.claim_ready_the_invited_shop($1, 'anything')`, [uid]), /permission denied/);
});

test('only an admin writes a Setnayan invite: a signed-in non-admin cannot create one carrying an offer, nor see one', async () => {
  // The offer columns inherit vendor_invites' table-level grants (exposure baseline). What keeps a free plan out of
  // a non-admin's reach is the ROW: source = 'admin' rows pass only vendor_invites_admin_write_all, and the couple
  // policies need a vendor_id that the admin CHECK forbids. If either is ever relaxed, this goes red.
  const { token } = await adminInvites(adminUid, 'Hidden Offer', 'caterer', { tier: 'enterprise', untilDays: 60 });
  const uid = await signUp('plain-user@example.ph', 'customer');
  await asUser(uid);
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_invites (vendor_id, email, business_name, claim_token, status, source, expires_at, offer_tier, offer_until)
       VALUES (NULL, 'plain-user@example.ph', 'Self Gift', 'self-gift-1', 'pending', 'admin', now() + interval '9 days', 'enterprise', now() + interval '999 days')`,
    ),
    /row-level security/,
  );
  const seen = await db.query(`SELECT 1 FROM public.vendor_invites WHERE claim_token = $1`, [token]);
  assert.equal(seen.rows.length, 0, 'a non-admin can read a Setnayan invite and its offer');
  const changed = await db.query(
    `UPDATE public.vendor_invites SET offer_until = now() + interval '999 days' WHERE claim_token = $1 RETURNING 1`,
    [token],
  );
  assert.equal(changed.rows.length, 0, 'a non-admin moved a Setnayan invite\'s gift date');
  await asOwner();
});

test('the shop can read its allowance but never write it; a stranger cannot read it', async () => {
  const { token, email } = await adminInvites(adminUid, 'Self Grant', 'hmua', { photos: 100 });
  const uid = await signUp(email, 'vendor');
  const shop = await finalize(uid, token);
  await asUser(uid);
  const mine = await db.query<{ a: number }>(`SELECT portfolio_photo_allowance AS a FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop]);
  assert.equal(mine.rows[0]?.a, 100);
  await assert.rejects(
    db.query(`UPDATE public.vendor_profiles SET portfolio_photo_allowance = 1000 WHERE vendor_profile_id = $1`, [shop]),
    /not writable by the vendor/,
  );
  await asOwner();
  const anon = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('anon', 'public.vendor_profiles', 'portfolio_photo_allowance', 'SELECT') AS ok`,
  );
  assert.equal(anon.rows[0]!.ok, false);
});
