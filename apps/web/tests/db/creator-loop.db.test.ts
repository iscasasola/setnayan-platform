/**
 * Creator-economy loop — END-TO-END DB verification (executed, not prose).
 *
 * Exercises the REAL production schema (all supabase/migrations replayed into
 * an in-process PGlite — see ./replay-migrations.ts) covering:
 *
 *   (a) CREATOR  — chapter draft/publish under the real RLS policies; the
 *       increment_chapter_view RPC self-gates (draft / hidden profile never
 *       accrue views). [App-side cookie dedup + /u rendering are app-layer.]
 *   (b) HUB      — deny-by-default featuring: the /realstories Storytellers
 *       shelf predicate (status='published' AND showcase_featured_at IS NOT
 *       NULL, rank order) returns nothing until featured; unfeature/report-
 *       hide clear the stamp and the chapter drops off.
 *   (c) MONEY    — reach-token ESCROW AT SEND (migration 20270819350491): the
 *       four header walkthroughs plus decline-still-costs, insufficient-
 *       balance rollback, the influencer-spend ledger tag, and the member-
 *       draw wallet branch.
 *   (d) GATES    — draft/hidden-profile chapters invisible to the public-read
 *       policy; a hidden-profile creator is NOT offerable (NOT_A_CREATOR);
 *       chapter reports ride user_reports with NULL event_id.
 *
 * Run: pnpm --filter @setnayan/web test:db
 * No docker, no supabase CLI, no network, no prod access. First boot replays
 * ~790 migrations (~10 s), then tests run against the shared instance.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** Insert an auth user (fires the real on_auth_user_created trigger). */
async function createUser(email: string, accountType: 'customer' | 'vendor' = 'customer') {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function setPublicProfile(userId: string, enabled: boolean) {
  await db.query(`UPDATE public.users SET public_profile_enabled = $2 WHERE user_id = $1`, [
    userId,
    enabled,
  ]);
}

/** Vendor fixture: profile at a tier + owner team seat + store wallet. */
async function createVendor(founderUserId: string, tier: string, purchasedTokens: number) {
  // Vendor-type signups get a vendor_profiles row auto-provisioned by the real
  // signup trigger — adopt it and set the tier under test.
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, tier_state)
     VALUES ($1, $3, $2::public.vendor_tier_state)
     ON CONFLICT (user_id) DO UPDATE SET tier_state = EXCLUDED.tier_state
     RETURNING vendor_profile_id`,
    [founderUserId, tier, `Loop Test Studio ${founderUserId.slice(0, 8)}`],
  );
  const vendorId = r.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [vendorId, founderUserId],
  );
  await db.query(
    `INSERT INTO public.vendor_wallets (vendor_id, purchased_tokens, earned_tokens)
     VALUES ($1, $2, 0)
     ON CONFLICT (vendor_id) DO UPDATE SET purchased_tokens = $2, earned_tokens = 0`,
    [vendorId, purchasedTokens],
  );
  return vendorId;
}

async function walletBalance(vendorId: string): Promise<number> {
  const r = await db.query<{ bal: number }>(
    `SELECT COALESCE(earned_tokens,0) + COALESCE(purchased_tokens,0) AS bal
       FROM public.vendor_wallets WHERE vendor_id = $1`,
    [vendorId],
  );
  return Number(r.rows[0]?.bal ?? 0);
}

/** The exact Storytellers-shelf predicate /realstories renders from. */
async function shelfPublicIds(): Promise<string[]> {
  const r = await db.query<{ public_id: string }>(
    `SELECT c.public_id
       FROM public.creator_chapters c
       JOIN public.users u ON u.user_id = c.user_id AND u.public_profile_enabled = TRUE
      WHERE c.status = 'published' AND c.showcase_featured_at IS NOT NULL
      ORDER BY c.showcase_feature_rank ASC NULLS LAST, c.showcase_featured_at DESC`,
  );
  return r.rows.map((x) => x.public_id);
}

async function expectRaise(sql: string, params: unknown[], code: string) {
  await assert.rejects(
    async () => {
      await db.query(sql, params);
    },
    (e: Error) => e.message.includes(code),
    `expected ${code}`,
  );
  await db.exec('ROLLBACK').catch(() => {});
}

// Shared fixture ids, built once in `before`.
const F = {} as {
  creator: string; // public-profile creator with chapters
  creatorChapterId: string; // published chapter uuid
  creatorChapterPublicId: string; // S89C-… of the published chapter
  draftPublicId: string;
  hiddenCreator: string; // published chapter but profile NOT public
  stranger: string; // plain customer, no vendor membership
  founder: string; // vendor founder (pro tier)
  vendor: string; // vendor_profile_id (pro, wallet 3)
  freeFounder: string;
  freeVendor: string; // free-tier vendor
  memberUser: string; // non-founder answering member with a personal wallet
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.creator = await createUser('creator@loop.test');
  F.hiddenCreator = await createUser('hidden-creator@loop.test');
  F.stranger = await createUser('stranger@loop.test');
  F.founder = await createUser('founder@loop.test', 'vendor');
  F.freeFounder = await createUser('free-founder@loop.test', 'vendor');
  F.memberUser = await createUser('member@loop.test', 'vendor');

  await setPublicProfile(F.creator, true);
  // hiddenCreator keeps public_profile_enabled = FALSE (the gate under test)

  F.vendor = await createVendor(F.founder, 'pro', 3);
  F.freeVendor = await createVendor(F.freeFounder, 'free', 5);

  // Non-founder answering member on the pro vendor with a personal wallet.
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'agent') ON CONFLICT DO NOTHING`,
    [F.vendor, F.memberUser],
  );
  await db.query(
    `INSERT INTO public.vendor_member_token_wallets (vendor_id, user_id, purchased_tokens)
     VALUES ($1, $2, 1)
     ON CONFLICT (vendor_id, user_id) DO UPDATE SET purchased_tokens = 1`,
    [F.vendor, F.memberUser],
  );

  // hiddenCreator gets a published chapter (service-role write, as the app's
  // admin client would) — publishing alone must NOT make them offerable.
  await db.query(
    `INSERT INTO public.creator_chapters (user_id, title, kind, embed_url, embed_provider, status, published_at)
     VALUES ($1, 'Hidden profile chapter', 'travel',
             'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtube', 'published', now())`,
    [F.hiddenCreator],
  );
});

after(async () => {
  await db?.close();
});

// ─── replay sanity ───────────────────────────────────────────────────────────

test('replay: every migration applied (allowed skips documented)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
  assert.ok(replay.skipped.length <= 4, `skips: ${JSON.stringify(replay.skipped)}`);
  for (const s of replay.skipped) assert.ok(s.reason.length > 10);
});

// ─── (a) creator: chapter lifecycle under real RLS ──────────────────────────

test('creator can INSERT a draft chapter under the owner-write RLS policy', async () => {
  await setAuthUid(db, F.creator);
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ chapter_id: string; public_id: string; status: string }>(
    `INSERT INTO public.creator_chapters (user_id, title, kind, embed_url, embed_provider)
     VALUES ($1, 'Our Boracay wedding, the full film', 'wedding',
             'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw', 'youtube')
     RETURNING chapter_id, public_id, status`,
    [F.creator],
  );
  await db.exec(`RESET ROLE`);
  assert.equal(r.rows[0]!.status, 'draft', 'defaults to draft');
  assert.match(r.rows[0]!.public_id, /^S89C-/, 'canonical S89C public id');
  F.creatorChapterId = r.rows[0]!.chapter_id;
  F.creatorChapterPublicId = r.rows[0]!.public_id;
});

test('a creator cannot write a chapter into someone else’s timeline (RLS)', async () => {
  await setAuthUid(db, F.stranger);
  await db.exec(`SET ROLE authenticated`);
  await assert.rejects(async () => {
    await db.query(
      `INSERT INTO public.creator_chapters (user_id, title, kind)
       VALUES ($1, 'forged', 'travel')`,
      [F.creator], // stranger writing under creator's user_id
    );
  }, /row-level security/);
  await db.exec('ROLLBACK').catch(() => {});
  await db.exec(`RESET ROLE`);
});

test('draft chapter is INVISIBLE to strangers and anon (public-read RLS)', async () => {
  for (const role of ['authenticated', 'anon']) {
    if (role === 'authenticated') await setAuthUid(db, F.stranger);
    else await setAuthUid(db, null);
    await db.exec(`SET ROLE ${role}`);
    const r = await db.query(
      `SELECT 1 FROM public.creator_chapters WHERE chapter_id = $1`,
      [F.creatorChapterId],
    );
    await db.exec(`RESET ROLE`);
    assert.equal(r.rows.length, 0, `draft hidden from ${role}`);
  }
});

test('publish: owner flips draft→published; readable on the app read path', async () => {
  await setAuthUid(db, F.creator);
  await db.exec(`SET ROLE authenticated`);
  await db.query(
    `UPDATE public.creator_chapters SET status='published', published_at=now() WHERE chapter_id=$1`,
    [F.creatorChapterId],
  );
  // owner still sees their own published row
  const own = await db.query(
    `SELECT 1 FROM public.creator_chapters WHERE chapter_id = $1`,
    [F.creatorChapterId],
  );
  await db.exec(`RESET ROLE`);
  assert.equal(own.rows.length, 1);

  // The PRODUCT read path (lib/creator-public.ts) is the service-role admin
  // client + app-code gates — that path sees the published row.
  await db.exec(`SET ROLE service_role`);
  const r = await db.query<{ embed_url: string }>(
    `SELECT embed_url FROM public.creator_chapters WHERE chapter_id = $1`,
    [F.creatorChapterId],
  );
  await db.exec(`RESET ROLE`);
  assert.equal(r.rows.length, 1, 'published chapter visible on the service-role read path');
  assert.match(r.rows[0]!.embed_url, /^https:\/\/www\.youtube-nocookie\.com\/embed\//);

  // ⚠ FINDING (documented, fails closed — not a leak): the defense-in-depth
  // policy public_can_read_published_chapter (TO anon, authenticated) can
  // never return rows for anyone but the owner/admin, because its EXISTS
  // subquery on public.users runs under the CALLER's users-RLS (own-row +
  // admin only; no anon policy at all) — so the "public read" policy is dead
  // as written. The app never relies on it (service-role reads), but a
  // PostgREST-direct public read would silently return empty. If the policy
  // is ever fixed (e.g. SECURITY DEFINER helper for the public-profile
  // check), flip this assertion to 1.
  await setAuthUid(db, null);
  await db.exec(`SET ROLE anon`);
  const anonRead = await db.query(
    `SELECT 1 FROM public.creator_chapters WHERE chapter_id = $1`,
    [F.creatorChapterId],
  );
  await db.exec(`RESET ROLE`);
  assert.equal(anonRead.rows.length, 0, 'documented finding: anon public-read policy is dead-as-written');
});

test('published chapter on a HIDDEN profile stays publicly invisible (RLS gate)', async () => {
  await setAuthUid(db, F.stranger);
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query(
    `SELECT 1 FROM public.creator_chapters WHERE user_id = $1 AND status = 'published'`,
    [F.hiddenCreator],
  );
  await db.exec(`RESET ROLE`);
  assert.equal(r.rows.length, 0, 'hidden-profile chapter never leaks');
});

test('increment_chapter_view self-gates: counts published+public only', async () => {
  // published + public → +1 per call (per-refresh dedup is an app-layer cookie)
  await db.query(`SELECT public.increment_chapter_view($1)`, [F.creatorChapterPublicId]);
  let r = await db.query<{ view_count: string }>(
    `SELECT view_count FROM public.creator_chapters WHERE chapter_id = $1`,
    [F.creatorChapterId],
  );
  assert.equal(Number(r.rows[0]!.view_count), 1, 'public chapter counted');

  // draft → never counted
  const draft = await db.query<{ public_id: string }>(
    `INSERT INTO public.creator_chapters (user_id, title, kind) VALUES ($1, 'wip', 'food')
     RETURNING public_id`,
    [F.creator],
  );
  F.draftPublicId = draft.rows[0]!.public_id;
  await db.query(`SELECT public.increment_chapter_view($1)`, [F.draftPublicId]);
  r = await db.query<{ view_count: string }>(
    `SELECT view_count FROM public.creator_chapters WHERE public_id = $1`,
    [F.draftPublicId],
  );
  assert.equal(Number(r.rows[0]!.view_count), 0, 'draft never accrues views');

  // published on hidden profile → never counted
  const hidden = await db.query<{ public_id: string }>(
    `SELECT public_id FROM public.creator_chapters WHERE user_id = $1`,
    [F.hiddenCreator],
  );
  await db.query(`SELECT public.increment_chapter_view($1)`, [hidden.rows[0]!.public_id]);
  r = await db.query<{ view_count: string }>(
    `SELECT view_count FROM public.creator_chapters WHERE public_id = $1`,
    [hidden.rows[0]!.public_id],
  );
  assert.equal(Number(r.rows[0]!.view_count), 0, 'hidden profile never accrues views');
});

// ─── (b) hub: deny-by-default featuring ─────────────────────────────────────

test('unfeatured published chapter does NOT appear on the Storytellers shelf', async () => {
  assert.deepEqual(await shelfPublicIds(), [], 'publish ≠ listed (deny-by-default)');
});

test('feature → on shelf; unfeature/report-hide clears → off shelf', async () => {
  // the admin Feature action's write (service-role UPDATE)
  await db.query(
    `UPDATE public.creator_chapters SET showcase_featured_at = now() WHERE public_id = $1`,
    [F.creatorChapterPublicId],
  );
  assert.deepEqual(await shelfPublicIds(), [F.creatorChapterPublicId], 'featured → listed');

  // hiding the owner's profile drops it off the shelf even while featured
  await setPublicProfile(F.creator, false);
  assert.deepEqual(await shelfPublicIds(), [], 'featured but hidden profile → not listed');
  await setPublicProfile(F.creator, true);

  // the Unfeature / report-hide resolution write (both clear the same stamp)
  await db.query(
    `UPDATE public.creator_chapters
        SET showcase_featured_at = NULL, showcase_feature_rank = NULL
      WHERE public_id = $1`,
    [F.creatorChapterPublicId],
  );
  assert.deepEqual(await shelfPublicIds(), [], 'cleared → delisted');
});

// ─── (d) report path ─────────────────────────────────────────────────────────

test('chapter reports ride user_reports with NULL event_id; event reports must carry one', async () => {
  await db.query(
    `INSERT INTO public.user_reports (reporter_user_id, target_type, target_id, reason)
     VALUES ($1, 'chapter', $2, 'spam')`,
    [F.stranger, F.creatorChapterPublicId],
  );
  const ok = await db.query(
    `SELECT 1 FROM public.user_reports WHERE target_type='chapter' AND target_id=$1`,
    [F.creatorChapterPublicId],
  );
  assert.equal(ok.rows.length, 1);

  await assert.rejects(async () => {
    await db.query(
      `INSERT INTO public.user_reports (reporter_user_id, target_type, target_id, reason)
       VALUES ($1, 'event', 'S89E-FAKEFAKE01', 'spam')`,
      [F.stranger],
    );
  }, /check|violates/i);
  await db.exec('ROLLBACK').catch(() => {});
});

// ─── offer gates (the RPC is the doorway the app calls) ─────────────────────

const SEND = `SELECT public.offer_creator_reach_hold($1::uuid, $2::uuid, $3::text) AS r`;

test('offer gates: FORBIDDEN / TIER_FREE / SELF_OFFER / MISSING_TERMS / NOT_A_CREATOR', async () => {
  // stranger is not an answering member of the vendor
  await setAuthUid(db, F.stranger);
  await expectRaise(SEND, [F.vendor, F.creator, '20% creator rate'], 'FORBIDDEN');

  // free-tier vendors cannot spend reach tokens
  await setAuthUid(db, F.freeFounder);
  await expectRaise(SEND, [F.freeVendor, F.creator, '20% creator rate'], 'TIER_FREE_NO_REACH');

  await setAuthUid(db, F.founder);
  // empty terms
  await expectRaise(SEND, [F.vendor, F.creator, '   '], 'MISSING_TERMS');
  // a founder cannot offer to themself
  await expectRaise(SEND, [F.vendor, F.founder, '20% rate'], 'SELF_OFFER');
  // target with no published chapter at all
  await expectRaise(SEND, [F.vendor, F.stranger, '20% rate'], 'NOT_A_CREATOR');
  // target with a published chapter but a NON-PUBLIC profile is not offerable
  await expectRaise(SEND, [F.vendor, F.hiddenCreator, '20% rate'], 'NOT_A_CREATOR');
});

// ─── (c) money: escrow-at-send walkthroughs ─────────────────────────────────

let offer1: string; // accepted
let offer2: string; // declined

test('send ESCROWS: wallet debited at send, ledger tagged creator_offer', async () => {
  assert.equal(await walletBalance(F.vendor), 3, 'fixture wallet');

  await setAuthUid(db, F.founder);
  const r = await db.query<{ r: { ok: boolean; escrowed: boolean; offer_id: string; tokens_charged: number } }>(
    SEND,
    [F.vendor, F.creator, '20% creator rate for a full chapter'],
  );
  const out = r.rows[0]!.r;
  assert.equal(out.ok, true);
  assert.equal(out.escrowed, true);
  assert.equal(out.tokens_charged, 1);
  offer1 = out.offer_id;

  assert.equal(await walletBalance(F.vendor), 2, 'token LEFT the wallet at send');

  const row = await db.query<{ status: string; escrowed_at: string; reach_token_ref: string }>(
    `SELECT status, escrowed_at, reach_token_ref FROM public.vendor_creator_offers WHERE offer_id=$1`,
    [offer1],
  );
  assert.equal(row.rows[0]!.status, 'pending');
  assert.ok(row.rows[0]!.escrowed_at, 'escrowed_at stamped');
  assert.equal(row.rows[0]!.reach_token_ref, `ESCROW:${offer1}`);

  const ledger = await db.query<{ spend_source: string; tokens_spent: number }>(
    `SELECT spend_source, tokens_spent FROM public.token_redemptions_log
      WHERE vendor_id=$1 AND service_code='CREATOR_REACH' AND metadata->>'offer_id'=$2`,
    [F.vendor, offer1],
  );
  assert.equal(ledger.rows.length, 1, 'exactly one burn row');
  assert.equal(ledger.rows[0]!.spend_source, 'creator_offer', 'influencer-spend tag stamped');
  assert.equal(Number(ledger.rows[0]!.tokens_spent), 1);
});

test('one outstanding offer per (vendor, creator): duplicate send refused', async () => {
  await setAuthUid(db, F.founder);
  await expectRaise(SEND, [F.vendor, F.creator, 'second offer'], 'OFFER_PENDING');
  assert.equal(await walletBalance(F.vendor), 2, 'refused send costs nothing');
});

test('only the addressed creator can respond', async () => {
  await setAuthUid(db, F.stranger);
  await expectRaise(
    `SELECT public.respond_creator_offer($1::uuid, 'accepted') AS r`,
    [offer1],
    'FORBIDDEN',
  );
});

test('ACCEPT settles — no further debit (walkthrough a)', async () => {
  await setAuthUid(db, F.creator);
  const r = await db.query<{ r: { ok: boolean; status: string; tokens_settled: number } }>(
    `SELECT public.respond_creator_offer($1::uuid, 'accepted', $2::uuid) AS r`,
    [offer1, F.creatorChapterId],
  );
  assert.equal(r.rows[0]!.r.status, 'accepted');
  assert.equal(r.rows[0]!.r.tokens_settled, 1, 'reports what was ACTUALLY debited at send');
  assert.equal(await walletBalance(F.vendor), 2, 'accept touches no wallet');

  const row = await db.query<{ deliverable_chapter_id: string }>(
    `SELECT deliverable_chapter_id FROM public.vendor_creator_offers WHERE offer_id=$1`,
    [offer1],
  );
  assert.equal(row.rows[0]!.deliverable_chapter_id, F.creatorChapterId, 'deliverable linked');

  const burns = await db.query(
    `SELECT 1 FROM public.token_redemptions_log
      WHERE vendor_id=$1 AND service_code='CREATOR_REACH' AND metadata->>'offer_id'=$2`,
    [F.vendor, offer1],
  );
  assert.equal(burns.rows.length, 1, 'still exactly one burn — respond consumed nothing');
});

test('DECLINE also settles — a “no” still costs the vendor the outreach', async () => {
  await setAuthUid(db, F.founder);
  const s = await db.query<{ r: { offer_id: string } }>(SEND, [
    F.vendor,
    F.creator,
    '15% rate, second campaign',
  ]);
  offer2 = s.rows[0]!.r.offer_id;
  assert.equal(await walletBalance(F.vendor), 1, 'second send debited');

  await setAuthUid(db, F.creator);
  const r = await db.query<{ r: { status: string; tokens_settled: number } }>(
    `SELECT public.respond_creator_offer($1::uuid, 'declined') AS r`,
    [offer2],
  );
  assert.equal(r.rows[0]!.r.status, 'declined');
  assert.equal(await walletBalance(F.vendor), 1, 'decline refunds nothing (owner lock)');
});

test('INSUFFICIENT balance refuses the send and leaves NO unpaid offer row (walkthrough b, serialized form)', async () => {
  // Drain the wallet to 0 with a third offer to a fresh creator target.
  const creator2 = await createUser('creator2@loop.test');
  await setPublicProfile(creator2, true);
  await db.query(
    `INSERT INTO public.creator_chapters (user_id, title, kind, embed_url, embed_provider, status, published_at)
     VALUES ($1, 'travel chapter', 'travel',
             'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', 'youtube', 'published', now())`,
    [creator2],
  );
  await setAuthUid(db, F.founder);
  await db.query(SEND, [F.vendor, creator2, 'drain offer']);
  assert.equal(await walletBalance(F.vendor), 0);

  // Now a fourth send (fresh target) must be REFUSED atomically.
  const creator3 = await createUser('creator3@loop.test');
  await setPublicProfile(creator3, true);
  await db.query(
    `INSERT INTO public.creator_chapters (user_id, title, kind, embed_url, embed_provider, status, published_at)
     VALUES ($1, 'food chapter', 'food',
             'https://www.youtube-nocookie.com/embed/9bZkp7q19f0', 'youtube', 'published', now())`,
    [creator3],
  );
  await setAuthUid(db, F.founder);
  await expectRaise(SEND, [F.vendor, creator3, 'broke offer'], 'INSUFFICIENT_WALLET_BALANCES');

  const orphan = await db.query(
    `SELECT 1 FROM public.vendor_creator_offers WHERE vendor_id=$1 AND creator_user_id=$2`,
    [F.vendor, creator3],
  );
  assert.equal(orphan.rows.length, 0, 'offer row rolled back with the failed debit — no unpaid offer');
  // Note: true two-connection concurrency is not exercisable in single-
  // connection PGlite; the FOR UPDATE serialization this asserts is the
  // post-lock balance re-read path of walkthrough (b).
});

test('EXPIRY: sweep refunds the escrow exactly once (walkthroughs c + d)', async () => {
  // Fund 1 token and send an offer that is ALREADY past its window.
  await db.query(`UPDATE public.vendor_wallets SET purchased_tokens = 1 WHERE vendor_id=$1`, [
    F.vendor,
  ]);
  const creator4 = await createUser('creator4@loop.test');
  await setPublicProfile(creator4, true);
  await db.query(
    `INSERT INTO public.creator_chapters (user_id, title, kind, embed_url, embed_provider, status, published_at)
     VALUES ($1, 'lifestyle chapter', 'lifestyle',
             'https://www.youtube-nocookie.com/embed/kJQP7kiw5Fk', 'youtube', 'published', now())`,
    [creator4],
  );
  await setAuthUid(db, F.founder);
  const s = await db.query<{ r: { offer_id: string } }>(
    `SELECT public.offer_creator_reach_hold($1::uuid, $2::uuid, $3::text, NULL, 1, now() - interval '1 hour') AS r`,
    [F.vendor, creator4, 'stale offer'],
  );
  const staleOffer = s.rows[0]!.r.offer_id;
  assert.equal(await walletBalance(F.vendor), 0, 'escrowed at send');

  // (d) responding past expires_at cannot resolve the offer
  await setAuthUid(db, creator4);
  await expectRaise(
    `SELECT public.respond_creator_offer($1::uuid, 'accepted') AS r`,
    [staleOffer],
    'OFFER_EXPIRED',
  );

  // (c) sweep → expired + refunded as purchased tokens, exactly once
  const sweep1 = await db.query(`SELECT * FROM public.sweep_expired_creator_offers()`);
  assert.equal(sweep1.rows.length, 1, 'sweep settles the stale offer');
  assert.equal(await walletBalance(F.vendor), 1, 'escrow refunded to the payer wallet');

  const row = await db.query<{ status: string; refunded_at: string }>(
    `SELECT status, refunded_at FROM public.vendor_creator_offers WHERE offer_id=$1`,
    [staleOffer],
  );
  assert.equal(row.rows[0]!.status, 'expired');
  assert.ok(row.rows[0]!.refunded_at, 'refunded_at is the exactly-once guard');

  const sweep2 = await db.query(`SELECT * FROM public.sweep_expired_creator_offers()`);
  assert.equal(sweep2.rows.length, 0, 'second sweep finds nothing');
  assert.equal(await walletBalance(F.vendor), 1, 'NO double refund');

  // a straggler response after the sweep is an idempotent no-op
  await setAuthUid(db, creator4);
  const late = await db.query<{ r: { already: boolean; status: string } }>(
    `SELECT public.respond_creator_offer($1::uuid, 'accepted') AS r`,
    [staleOffer],
  );
  assert.equal(late.rows[0]!.r.already, true);
  assert.equal(late.rows[0]!.r.status, 'expired');
});

test('MEMBER draw: personal wallet debited at send, refunded on expiry', async () => {
  const creator5 = await createUser('creator5@loop.test');
  await setPublicProfile(creator5, true);
  await db.query(
    `INSERT INTO public.creator_chapters (user_id, title, kind, embed_url, embed_provider, status, published_at)
     VALUES ($1, 'member-draw chapter', 'wedding',
             'https://www.youtube-nocookie.com/embed/2Vv-BfVoq4g', 'youtube', 'published', now())`,
    [creator5],
  );

  const memberBal = async () =>
    Number(
      (
        await db.query<{ b: number }>(
          `SELECT purchased_tokens AS b FROM public.vendor_member_token_wallets WHERE vendor_id=$1 AND user_id=$2`,
          [F.vendor, F.memberUser],
        )
      ).rows[0]!.b,
    );

  assert.equal(await memberBal(), 1);
  await setAuthUid(db, F.memberUser);
  const s = await db.query<{ r: { offer_id: string } }>(
    `SELECT public.offer_creator_reach_hold($1::uuid, $2::uuid, 'member 10% rate', NULL, 1, now() - interval '1 minute') AS r`,
    [F.vendor, creator5],
  );
  assert.equal(await memberBal(), 0, 'member personal wallet debited (not the store wallet)');

  const row = await db.query<{ is_founder_draw: boolean }>(
    `SELECT is_founder_draw FROM public.vendor_creator_offers WHERE offer_id=$1`,
    [s.rows[0]!.r.offer_id],
  );
  assert.equal(row.rows[0]!.is_founder_draw, false);

  await db.query(`SELECT * FROM public.sweep_expired_creator_offers()`);
  assert.equal(await memberBal(), 1, 'expiry refund lands back in the member wallet');
});

test('ledger integrity: every reach debit is tagged creator_offer', async () => {
  const r = await db.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM public.token_redemptions_log
      WHERE service_code='CREATOR_REACH' AND (spend_source IS DISTINCT FROM 'creator_offer')`,
  );
  assert.equal(Number(r.rows[0]!.n), 0, 'no untagged influencer spend');
});

// ─── (e) attribution integrity: provenance columns are write-locked ─────────
// PR-C money-path review G1 — the guard_thread_provenance_columns BEFORE UPDATE
// trigger (migration 20270820292403). referring_chapter_id / inquiry_source /
// is_returning may be stamped ONLY by a privileged caller (the service-role
// admin client, i.e. stampThreadProvenance). A thread party PATCHing them via
// PostgREST (the FOR-ALL chat_threads_member_write policy lets them UPDATE the
// row) has the forgery neutralized — the columns revert to their OLD value
// while every other column edit still lands.

/** Set the JWT role claim the harness's auth.role() reads (Supabase seam). */
async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

test('provenance guard: service-role first-stamp lands; a thread party PATCH is reverted', async () => {
  // Fixture — a couple, their event, and a thread to the pro vendor. The real
  // upsert path (apps/web/app/v/[slug]/inquiry-actions.ts) creates the thread
  // WITHOUT any provenance column, exactly as this INSERT does.
  const couple = await createUser('guard-couple@loop.test');
  // Non-wedding type so the fixture needn't satisfy the wedding-fields
  // consistency check — the provenance guard is event-type agnostic.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Guard Test Event', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, couple],
  );
  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id)
     VALUES ($1, $2, $3) RETURNING thread_id`,
    [eventId, F.vendor, couple],
  );
  const threadId = th.rows[0]!.thread_id;

  // 1. The legit first-stamp: stampThreadProvenance runs on the SERVICE-ROLE
  //    admin client (auth.role()='service_role') → privileged → the stamp lands.
  await setAuthUid(db, null);
  await setAuthRole('service_role');
  await db.exec(`SET ROLE service_role`);
  await db.query(
    `UPDATE public.chat_threads
        SET referring_chapter_id = $2, inquiry_source = 'influencer', is_returning = TRUE
      WHERE thread_id = $1
        AND referring_chapter_id IS NULL
        AND inquiry_source IS NULL`,
    [threadId, F.creatorChapterId],
  );
  await db.exec(`RESET ROLE`);
  const stamped = (
    await db.query<{ rc: string | null; src: string | null; ret: boolean }>(
      `SELECT referring_chapter_id AS rc, inquiry_source AS src, is_returning AS ret
         FROM public.chat_threads WHERE thread_id = $1`,
      [threadId],
    )
  ).rows[0]!;
  assert.equal(stamped.rc, F.creatorChapterId, 'service-role first-stamp lands');
  assert.equal(stamped.src, 'influencer', 'inquiry_source stamped');
  assert.equal(stamped.ret, true, 'is_returning stamped');

  // 2. A thread party (the couple member) tries to FORGE the provenance while
  //    also touching a non-guarded column (pax_current). RLS permits the UPDATE
  //    (member-write), so we can prove the TRIGGER — not RLS — protects the
  //    columns: pax_current changes, the three provenance columns do NOT.
  await setAuthUid(db, couple);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
  const forged = await db.query(
    `UPDATE public.chat_threads
        SET referring_chapter_id = NULL,
            inquiry_source = 'website',
            is_returning = FALSE,
            pax_current = 123
      WHERE thread_id = $1`,
    [threadId],
  );
  await db.exec(`RESET ROLE`);
  assert.equal(forged.affectedRows, 1, 'RLS allowed the member UPDATE (row matched)');
  const after = (
    await db.query<{ rc: string | null; src: string | null; ret: boolean; pax: number | null }>(
      `SELECT referring_chapter_id AS rc, inquiry_source AS src, is_returning AS ret, pax_current AS pax
         FROM public.chat_threads WHERE thread_id = $1`,
      [threadId],
    )
  ).rows[0]!;
  assert.equal(after.pax, 123, 'non-guarded column DID change → the write landed');
  assert.equal(after.rc, F.creatorChapterId, 'referring_chapter_id forgery reverted');
  assert.equal(after.src, 'influencer', 'inquiry_source forgery reverted');
  assert.equal(after.ret, true, 'is_returning forgery reverted');

  // Reset the harness identity for any later tests.
  await setAuthRole(null);
  await setAuthUid(db, null);
});
