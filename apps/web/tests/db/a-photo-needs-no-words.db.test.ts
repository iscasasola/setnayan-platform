/**
 * 📎 CHAT-01 (live fault, 14 Nov) — a photo sent with no words always failed (500): `chat_messages_body_check` demanded
 * length(body) > 0 and the send writes '' for a photo alone. Migration 20271346331739 loosens the check only:
 *   · a photo with no words saves;  · a photo with a caption still saves;
 *   · a message with NEITHER words nor a file is still refused;  · the 4,000-character ceiling still holds.
 * Run from apps/web: npx tsx --test tests/db/a-photo-needs-no-words.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const F = { couple: '', shop: '', event: '', thread: '' };

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0]!;
}
async function send(body: string, file: boolean): Promise<string | null> {
  try {
    await db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, attachment_r2_key, attachment_name, attachment_mime, attachment_size_bytes)
       VALUES ($1, $2, $3, $4, 'couple', $5, $6, $7, $8, $9)`,
      [F.thread, F.event, F.shop, F.couple, body, file ? 'r2://thread-files/t/photo.jpg' : null, file ? 'photo.jpg' : null, file ? 'image/jpeg' : null, file ? 1234 : null],
    );
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mkUser = async (email: string, t: string) =>
    (await one<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`, [email, t])).id;
  F.couple = await mkUser('chat01-couple@chat.test', 'customer');
  const vendor = await mkUser('chat01-vendor@chat.test', 'vendor');
  F.shop = (await one<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Photo Shop')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
    [vendor],
  )).vendor_profile_id;
  F.event = (await one<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Chat01', 'birthday') RETURNING event_id`)).event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.event, F.couple]);
  F.thread = (await one<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [F.event, F.shop, F.couple],
  )).thread_id;
});
after(async () => {
  await db?.close?.();
});

test('a photo with no words saves (the live 500)', async () => {
  assert.equal(await send('', true), null);
});
test('a photo with a caption still saves', async () => {
  assert.equal(await send('Our venue', true), null);
});
test('a message with neither words nor a file is still refused', async () => {
  const err = await send('', false);
  assert.ok(err && /chat_messages_body_check/.test(err), `an empty message was saved: ${err ?? 'saved'}`);
});
test('the 4,000-character ceiling still holds', async () => {
  const err = await send('x'.repeat(4001), true);
  assert.ok(err && /chat_messages_body_check/.test(err), `an over-long message was saved: ${err ?? 'saved'}`);
});
