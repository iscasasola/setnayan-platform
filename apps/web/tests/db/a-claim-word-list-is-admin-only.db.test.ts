/**
 * THE CLAIM-WORD LIST IS ADMIN-ONLY — against a replayed schema (…_service_card_checks_v2.sql).
 *
 * ⚖ Owner 2026-10-26 (DECISION_LOG "SERVICE CARD CHECKS — FIX BEFORE CREATE"; corpus
 * prototypes/service_card_checks_2026-10-26/ PLAN §2 check 1): the maker refuses a card carrying a word from
 * `card_claim_words`; admin edits the list. A supplier must neither read nor change it (the page and the save
 * read it with the service role), and the owner's six seed words are there from the start.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const F = { vendor: '', admin: '' };

async function reset() {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
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

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mk = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.vendor = await mk('words-vendor@checks.test', 'vendor');
  F.admin = await mk('words-admin@checks.test', 'customer');
  await db.query(
    `INSERT INTO public.users (user_id, email, account_type) VALUES ($1, 'words-admin@checks.test', 'admin')
     ON CONFLICT (user_id) DO UPDATE SET account_type = 'admin'`,
    [F.admin],
  );
});
after(async () => {
  await db?.close();
});

test('the owner’s six words are seeded', async () => {
  const words = (await db.query<{ phrase: string }>(`SELECT phrase FROM public.card_claim_words ORDER BY phrase`)).rows.map((r) => r.phrase);
  assert.deepEqual(words, ['#1', '100%', 'best in', 'guaranteed', 'lowest price', 'official']);
});

test('a supplier reads nothing and writes nothing', async () => {
  const seen = await as(F.vendor, async () => (await db.query(`SELECT 1 FROM public.card_claim_words`)).rows.length);
  assert.equal(seen, 0, 'a supplier can read the claim-word list');
  const ins = await refused(() => as(F.vendor, () => db.query(`INSERT INTO public.card_claim_words (phrase) VALUES ('cheapest')`)));
  assert.match(ins ?? '', /row-level security|permission denied/);
  await as(F.vendor, () => db.query(`DELETE FROM public.card_claim_words WHERE phrase = 'official'`));
  const still = await db.query(`SELECT 1 FROM public.card_claim_words WHERE phrase = 'official'`);
  assert.equal(still.rows.length, 1, 'a supplier deleted a word');
});

test('an admin reads, adds and removes', async () => {
  assert.equal(await as(F.admin, async () => (await db.query(`SELECT 1 FROM public.card_claim_words`)).rows.length), 6);
  await as(F.admin, () => db.query(`INSERT INTO public.card_claim_words (phrase, created_by) VALUES ('premier', $1)`, [F.admin]));
  await as(F.admin, () => db.query(`DELETE FROM public.card_claim_words WHERE phrase = 'premier'`));
  assert.equal((await db.query(`SELECT 1 FROM public.card_claim_words WHERE phrase = 'premier'`)).rows.length, 0);
});

test('a word is stored lower-case and trimmed, or refused', async () => {
  const err = await refused(() => db.query(`INSERT INTO public.card_claim_words (phrase) VALUES ('Official ')`));
  assert.match(err ?? '', /card_claim_words_phrase_check|check constraint/);
});

test('anon holds no grant on the list', async () => {
  const r = await db.query<{ ok: boolean }>(`SELECT has_table_privilege('anon', 'public.card_claim_words', 'SELECT') AS ok`);
  assert.equal(r.rows[0]!.ok, false);
});
