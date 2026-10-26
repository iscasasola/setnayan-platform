/**
 * A CARD VERDICT GOES THROUGH ONE DOOR — against a replayed schema (20271291565921_service_card_verdicts.sql, on
 * top of 20271290013489_service_card_checks.sql).
 *
 * ⚖ Owner 2026-10-26 (DECISION_LOG "APPROVED — SERVICE CARD CHECKS AS DRAWN"): a held card goes live on the admin's
 * Approve; claim words are admin-editable with a per-shop allowance. `approve_service_card()` is the one door: it
 * closes the hold AND puts the card live in one transaction, shuts the door behind it, and is not callable by a
 * supplier.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { makeCardPublishable } from './live-card-fixture';

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
  F.vendorUser = await mkUser('verdict-vendor@checks.test', 'vendor');
  F.vendorId = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Saysay Live Band')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
       RETURNING vendor_profile_id`,
      [F.vendorUser],
    )
  ).rows[0]!.vendor_profile_id;
  F.admin = await mkUser('verdict-admin@checks.test', 'customer');
  await db.query(
    `INSERT INTO public.users (user_id, email, account_type) VALUES ($1, 'verdict-admin@checks.test', 'admin')
     ON CONFLICT (user_id) DO UPDATE SET account_type = 'admin'`,
    [F.admin],
  );
});
after(async () => {
  await db?.close();
});

// ── the Approve door ────────────────────────────────────────────────────────

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


test('an allowance is per shop and goes with its word', async () => {
  await db.query(`INSERT INTO public.card_claim_words (phrase) VALUES ('premier') ON CONFLICT DO NOTHING`);
  await db.query(`INSERT INTO public.card_claim_word_allowances (vendor_profile_id, phrase, allowed_by) VALUES ($1, 'premier', $2)`, [F.vendorId, F.admin]);
  await db.query(`DELETE FROM public.card_claim_words WHERE phrase = 'premier'`);
  const left = await db.query(`SELECT 1 FROM public.card_claim_word_allowances WHERE phrase = 'premier'`);
  assert.equal(left.rows.length, 0);
});


test('Approve cannot publish a card the gate would refuse — and then nothing changes', async () => {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, is_active, starting_price_php)
     VALUES ($1, 'live_band', false, 42001) RETURNING vendor_service_id`,
    [F.vendorId],
  );
  const card = r.rows[0]!.vendor_service_id; // no cover, nothing included
  const id = await flag(card);
  const err = await refused(() =>
    asService(() => db.query(`SELECT public.approve_service_card($1, $2, NULL)`, [id, F.admin])),
  );
  assert.match(err ?? '', /cover photo/);
  assert.equal(await isActive(card), false);
  const st = await db.query<{ status: string }>(`SELECT status FROM public.integrity_flags WHERE id = $1`, [id]);
  assert.equal(st.rows[0]!.status, 'open', 'the flag closed although the card did not go live');
});
