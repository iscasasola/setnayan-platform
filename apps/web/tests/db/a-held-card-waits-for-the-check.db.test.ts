/**
 * A HELD SERVICE CARD WAITS FOR THE CHECK — against a replayed schema
 * (20271290013489_service_card_checks.sql).
 *
 * ⚖ Owner 2026-10-26 (DECISION_LOG "APPROVED — SERVICE CARD CHECKS AS DRAWN"):
 * *"Cards go live right away after automatic checks; only flagged cards wait
 * for admin review."* — a held card is `is_active = false` + a holding
 * `integrity_flags(kind='service_card')` row, and the hold goes away only on an
 * admin's Approve.
 *
 * 🔑 WHY THE DATABASE, NOT ONLY THE SAVE. `authenticated` holds UPDATE on every
 * column of `vendor_services` under a row-ownership policy, and the shop's
 * on/off switch writes through the user's own session. A hold that lived only
 * in `commitVendorService` would be undone by one PATCH. So these cases run AS
 * THE SUPPLIER'S SESSION (SET ROLE authenticated + the JWT sub), where
 * `integrity_flags` is unreadable under RLS — the exact place a naive EXISTS in
 * the trigger would read "not held" and let the card through.
 *
 * Every case asserts a VALUE both ways: a refusal carries the sentence, an
 * acceptance leaves the row live.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { insertLiveCard, makeCardPublishable } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;

const HOLD_SENTENCE = "This card is waiting for a quick check, so it can't be switched on yet.";

const F = { vendorUser: '', vendorId: '', admin: '' };

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function isActive(id: string): Promise<boolean> {
  const r = await db.query<{ is_active: boolean }>(
    `SELECT is_active FROM public.vendor_services WHERE vendor_service_id = $1`,
    [id],
  );
  assert.equal(r.rows.length, 1, 'the card under test does not exist — the case proved nothing');
  return r.rows[0]!.is_active;
}

/** A publishable DRAFT card (cover + price + one inclusion), not live. */
async function publishableDraft(price: number): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, is_active, starting_price_php)
     VALUES ($1, 'live_band', false, $2) RETURNING vendor_service_id`,
    [F.vendorId, price],
  );
  const id = r.rows[0]!.vendor_service_id;
  await makeCardPublishable(db, id);
  return id;
}

async function flag(serviceId: string, status = 'open'): Promise<number> {
  const r = await db.query<{ id: number }>(
    `INSERT INTO public.integrity_flags (kind, subject_vendor_id, subject_service_id, score, reason, detail, status)
     VALUES ('service_card', $1, $2, 40, 'words', '{"reasons":[{"code":"words","hits":["guaranteed"]}]}'::jsonb, $3)
     RETURNING id`,
    [F.vendorId, serviceId, status],
  );
  return r.rows[0]!.id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.vendorUser = await mkUser('held-card-vendor@checks.test', 'vendor');
  F.vendorId = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Saysay Live Band')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
       RETURNING vendor_profile_id`,
      [F.vendorUser],
    )
  ).rows[0]!.vendor_profile_id;
  F.admin = await mkUser('held-card-admin@checks.test', 'customer');
  await db.query(
    `INSERT INTO public.users (user_id, email, account_type) VALUES ($1, 'held-card-admin@checks.test', 'admin')
     ON CONFLICT (user_id) DO UPDATE SET account_type = 'admin'`,
    [F.admin],
  );
});
after(async () => {
  await db?.close();
});

// ── the flag's shape ────────────────────────────────────────────────────────

test('a service_card flag must name a card; an older kind may not', async () => {
  const noCard = await refused(() =>
    db.query(
      `INSERT INTO public.integrity_flags (kind, subject_vendor_id, score, reason)
       VALUES ('service_card', $1, 40, 'words')`,
      [F.vendorId],
    ),
  );
  assert.match(noCard ?? '', /integrity_flags_kind_shape/);

  const card = await publishableDraft(41001);
  const ghostWithCard = await refused(() =>
    db.query(
      `INSERT INTO public.integrity_flags (kind, subject_vendor_id, subject_service_id, score, reason)
       VALUES ('ghost_listing', $1, $2, 40, 'placeholder_listing')`,
      [F.vendorId, card],
    ),
  );
  assert.match(ghostWithCard ?? '', /integrity_flags_kind_shape/);

  const id = await flag(card);
  assert.ok(id > 0, 'a well-shaped service_card flag was refused');
});

test('every earlier kind and status still fits the re-listed CHECKs', async () => {
  // A re-listed CHECK that copied a shorter list would drop one of these.
  for (const kind of ['ghost_listing', 'inquiry_concentration']) {
    for (const status of ['open', 'dismissed', 'confirmed_fraud', 'listing_hidden']) {
      await db.query(
        `INSERT INTO public.integrity_flags (kind, subject_vendor_id, score, reason, status)
         VALUES ($1, $2, 10, 'x', $3)`,
        [kind, F.vendorId, status],
      );
      await db.query(`DELETE FROM public.integrity_flags WHERE kind = $1 AND subject_vendor_id = $2`, [kind, F.vendorId]);
    }
  }
});

test('at most ONE holding flag per card; closed history does not count', async () => {
  const card = await publishableDraft(41002);
  await flag(card, 'approved');
  await flag(card, 'dismissed');
  await flag(card, 'open');
  const second = await refused(() => flag(card, 'rejected'));
  assert.match(second ?? '', /integrity_flags_card_uniq|duplicate key/);
});

// ── the hold, as the supplier's own session ─────────────────────────────────

test('the supplier’s session sees its own hold (yes/no only)', async () => {
  const card = await publishableDraft(41003);
  assert.equal(await as(F.vendorUser, async () => (await db.query<{ h: boolean }>(`SELECT public.service_card_held($1) AS h`, [card])).rows[0]!.h), false);
  await flag(card);
  assert.equal(await as(F.vendorUser, async () => (await db.query<{ h: boolean }>(`SELECT public.service_card_held($1) AS h`, [card])).rows[0]!.h), true);
  const rows = await as(F.vendorUser, async () => (await db.query(`SELECT 1 FROM public.integrity_flags WHERE subject_service_id = $1`, [card])).rows.length);
  assert.equal(rows, 0, 'the supplier can read integrity_flags — the reason and any other shop would leak');
});

test('a supplier CANNOT switch a held card on — refused with the sentence', async () => {
  const card = await publishableDraft(41004);
  await flag(card);
  const err = await refused(() =>
    as(F.vendorUser, () =>
      db.query(`UPDATE public.vendor_services SET is_active = true WHERE vendor_service_id = $1`, [card]),
    ),
  );
  assert.equal(err, HOLD_SENTENCE);
  assert.equal(await isActive(card), false);
});

test('a REJECTED card is still held — one switch must not undo a reject', async () => {
  const card = await publishableDraft(41005);
  await flag(card, 'rejected');
  const err = await refused(() =>
    as(F.vendorUser, () =>
      db.query(`UPDATE public.vendor_services SET is_active = true WHERE vendor_service_id = $1`, [card]),
    ),
  );
  assert.equal(err, HOLD_SENTENCE);
  assert.equal(await isActive(card), false);
});

test('the same supplier CAN switch on a card that is not held (the fence is the flag, nothing else)', async () => {
  const card = await publishableDraft(41006);
  await flag(card, 'approved'); // history, not a hold
  await as(F.vendorUser, () =>
    db.query(`UPDATE public.vendor_services SET is_active = true WHERE vendor_service_id = $1`, [card]),
  );
  assert.equal(await isActive(card), true);
});

test('save_vendor_service cannot publish a held card either (the save path’s backstop)', async () => {
  const card = await publishableDraft(41007);
  await flag(card);
  const err = await refused(() =>
    asService(() =>
      db.query(
        `SELECT public.save_vendor_service($1::uuid, $2::uuid, $3::jsonb,
           '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $4::jsonb, true)`,
        [
          F.vendorId,
          card,
          JSON.stringify({ category: 'live_band', starting_price_php: 41007, primary_photo_r2_key: 'r2://media/x/cover.webp' }),
          JSON.stringify([{ label: 'Sound system' }]),
        ],
      ),
    ),
  );
  assert.equal(err, HOLD_SENTENCE);
  assert.equal(await isActive(card), false);
});

test('a LIVE card’s edit is untouched by the hold arm (only going live is judged)', async () => {
  const card = await insertLiveCard(db, { vendor_profile_id: F.vendorId, category: 'live_band', starting_price_php: 41008 });
  await as(F.vendorUser, () =>
    db.query(`UPDATE public.vendor_services SET title = 'Renamed' WHERE vendor_service_id = $1`, [card]),
  );
  assert.equal(await isActive(card), true);
});

// ── the doors ───────────────────────────────────────────────────────────────

test('approve_service_card closes the flag AND puts the card live, once', async () => {
  const card = await publishableDraft(41009);
  const id = await flag(card, 'asked_to_fix');
  const first = await asService(async () =>
    (await db.query<{ ok: boolean }>(`SELECT public.approve_service_card($1, $2, NULL) AS ok`, [id, F.admin])).rows[0]!.ok,
  );
  assert.equal(first, true);
  assert.equal(await isActive(card), true);
  const st = await db.query<{ status: string; reviewed_by: string }>(`SELECT status, reviewed_by FROM public.integrity_flags WHERE id = $1`, [id]);
  assert.equal(st.rows[0]!.status, 'approved');
  assert.equal(st.rows[0]!.reviewed_by, F.admin);

  const again = await asService(async () =>
    (await db.query<{ ok: boolean }>(`SELECT public.approve_service_card($1, $2, NULL) AS ok`, [id, F.admin])).rows[0]!.ok,
  );
  assert.equal(again, false, 'a stale second Approve changed something');
});

test('the verdict door shuts after the approve — the same transaction cannot flip another held card', async () => {
  const a = await publishableDraft(41010);
  const b = await publishableDraft(41011);
  const ida = await flag(a);
  await flag(b);
  const err = await refused(() =>
    asService(() =>
      db.transaction(async (tx) => {
        await tx.query(`SELECT public.approve_service_card($1, $2, NULL)`, [ida, F.admin]);
        await tx.query(`UPDATE public.vendor_services SET is_active = true WHERE vendor_service_id = $1`, [b]);
      }),
    ),
  );
  assert.equal(err, HOLD_SENTENCE);
  assert.equal(await isActive(b), false);
});

test('a supplier cannot call approve_service_card', async () => {
  const card = await publishableDraft(41012);
  const id = await flag(card);
  const err = await refused(() =>
    as(F.vendorUser, () => db.query(`SELECT public.approve_service_card($1, $2, NULL)`, [id, F.vendorUser])),
  );
  assert.match(err ?? '', /permission denied/);
  assert.equal(await isActive(card), false);
});

test('an admin’s own session may switch a held card on (the admin door)', async () => {
  const card = await publishableDraft(41013);
  await flag(card);
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [F.admin]);
  try {
    await db.query(`UPDATE public.vendor_services SET is_active = true WHERE vendor_service_id = $1`, [card]);
  } finally {
    await reset();
  }
  assert.equal(await isActive(card), true);
});

// ── the words, the tolerance, the showcase surface ─────────────────────────

test('the owner’s six claim words are seeded, and only an admin can read them', async () => {
  const words = (await db.query<{ phrase: string }>(`SELECT phrase FROM public.card_claim_words ORDER BY phrase`)).rows.map((r) => r.phrase);
  assert.deepEqual(words, ['#1', '100%', 'best in', 'guaranteed', 'lowest price', 'official']);
  const asVendor = await as(F.vendorUser, async () => (await db.query(`SELECT 1 FROM public.card_claim_words`)).rows.length);
  assert.equal(asVendor, 0, 'a supplier can read the claim-word list');
  const asAdmin = await as(F.admin, async () => (await db.query(`SELECT 1 FROM public.card_claim_words`)).rows.length);
  assert.equal(asAdmin, 6);
  const notLower = await refused(() => db.query(`INSERT INTO public.card_claim_words (phrase) VALUES ('Official ')`));
  assert.match(notLower ?? '', /card_claim_words_phrase_check|check constraint/);
});

test('an allowance is per shop and goes with its word', async () => {
  await db.query(`INSERT INTO public.card_claim_words (phrase) VALUES ('premier') ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO public.card_claim_word_allowances (vendor_profile_id, phrase, allowed_by) VALUES ($1, 'premier', $2)`, [F.vendorId, F.admin]);
  await db.query(`DELETE FROM public.card_claim_words WHERE phrase = 'premier'`);
  const left = await db.query(`SELECT 1 FROM public.card_claim_word_allowances WHERE phrase = 'premier'`);
  assert.equal(left.rows.length, 0);
});

test('the price tolerance exists and is OFF (NULL) until the owner sets it', async () => {
  const r = await db.query<{ t: string | null }>(`SELECT card_price_band_tolerance::text AS t FROM public.platform_settings WHERE id = 1`);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.t, null, 'a tolerance was invented — the ruling says off until set');
  const tooBig = await refused(() => db.query(`UPDATE public.platform_settings SET card_price_band_tolerance = 1.5 WHERE id = 1`));
  assert.match(tooBig ?? '', /card_price_band_tolerance_check/);
});

test('repost-watch accepts the showcase surface', async () => {
  await db.query(
    `INSERT INTO public.vendor_image_hashes (vendor_profile_id, surface, r2_ref, phash, is_demo)
     VALUES ($1, 'service_showcase', 'r2://media/x/showcase-1.webp', '0', false)`,
    [F.vendorId],
  );
});
