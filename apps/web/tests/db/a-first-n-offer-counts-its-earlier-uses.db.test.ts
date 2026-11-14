/**
 * 🧾 OWN-01 — A "FIRST N COUPLES" OFFER COUNTS ITS EARLIER USES. Migration 20271346038449, replayed (PGlite).
 *
 * Live 14 Nov: a "first 1 couple" ₱5,000 offer went on a SECOND couple's quote an hour after the first, because
 * `first_n_taken` had no writer and the card-seeded discount line named no offer. Here, with the line naming its offer
 * (`from_offer_id`, as the maker now writes it):
 *   1 · the first couple's quote sends, and the offer reads 1 taken;
 *   2 · the SECOND couple's quote carrying it is refused at send (OFFER_TAKEN) — the bug;
 *   3 · the first couple's own quote still moves (sent → accepted), and a new version for the SAME couple still sends;
 *   4 · when the first couple's quote is declined the offer frees up, and the second couple's quote sends;
 *   5 · an offer's own named line (`offer_id`) counts the same way.
 *
 * SABOTAGE (seen red, PR body): drop the RAISE in tg_vendor_proposals_first_n_cap → test 2 green-lights the second
 * couple; drop the AFTER trigger → "1 taken" reads 0.
 * Run from apps/web: npx tsx --test tests/db/a-first-n-offer-counts-its-earlier-uses.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const F = { couple: '', vendorUser: '', shop: '', offer: '', offerOwn: '' };

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0]!;
}
const TODAY = `(NOW() AT TIME ZONE 'Asia/Manila')::date`;

async function event(tag: string): Promise<string> {
  const id = (await one<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`, [tag])).event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [id, F.couple]);
  return id;
}
/** A draft quote whose Discount line was filled in from an offer (or an offer's own line). */
async function draft(eventId: string, offerId: string, key: 'from_offer_id' | 'offer_id' = 'from_offer_id'): Promise<string> {
  const lines = [
    { label: 'Reception Lights & Sound', detail: null, amount_centavos: 4500000 },
    { label: 'Discount', detail: 'First 1 · ₱5,000 off', amount_centavos: -500000, [key]: offerId },
  ];
  return (await one<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, line_items, status, valid_until)
     VALUES ($1, $2, 'Quote', 4000000, $3::jsonb, 'draft', ${TODAY} + 7) RETURNING proposal_id`,
    [F.shop, eventId, JSON.stringify(lines)],
  )).proposal_id;
}
async function send(proposalId: string): Promise<string | null> {
  try {
    await db.query(`UPDATE public.vendor_proposals SET status = 'sent', sent_at = NOW() WHERE proposal_id = $1`, [proposalId]);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
const taken = async (publicId: string) =>
  (await one<{ n: number }>(`SELECT first_n_taken AS n FROM public.vendor_offers WHERE public_id = $1`, [publicId])).n;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mkUser = async (email: string, t: string) =>
    (await one<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`, [email, t])).id;
  F.couple = await mkUser('own01-couple@offer.test', 'customer');
  F.vendorUser = await mkUser('own01-vendor@offer.test', 'vendor');
  F.shop = (await one<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Liwanag Lights & Sound')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
    [F.vendorUser],
  )).vendor_profile_id;
  const mkOffer = async (name: string) =>
    (await one<{ public_id: string }>(
      `INSERT INTO public.vendor_offers (vendor_profile_id, name, php_off, who, first_n_cap) VALUES ($1, $2, 5000, 'first_n', 1) RETURNING public_id`,
      [F.shop, name],
    )).public_id;
  F.offer = await mkOffer('December first couple');
  F.offerOwn = await mkOffer('Own-line first couple');
});
after(async () => {
  await db?.close?.();
});

test('the first couple sends with the offer, and it reads 1 taken', async () => {
  assert.equal(await taken(F.offer), 0);
  const e1 = await event('first couple');
  assert.equal(await send(await draft(e1, F.offer)), null);
  assert.equal(await taken(F.offer), 1, 'the count did not follow the sent quote — nothing writes first_n_taken');
});

test('the SECOND couple’s quote with a used-up first-1 offer is refused at send (OWN-01)', async () => {
  const e2 = await event('second couple');
  const err = await send(await draft(e2, F.offer));
  assert.ok(err && /OFFER_TAKEN/.test(err), `the second couple got the first-1 offer: ${err ?? 'sent'}`);
  assert.equal(await taken(F.offer), 1);
});

test('the first couple’s own quote still moves, and a new version for the SAME couple still sends', async () => {
  const e1 = (await one<{ event_id: string }>(`SELECT event_id FROM public.events WHERE display_name = 'first couple'`)).event_id;
  await db.query(`UPDATE public.vendor_proposals SET status = 'accepted', resolved_at = NOW() WHERE event_id = $1 AND status = 'sent'`, [e1]);
  assert.equal(await taken(F.offer), 1);
  assert.equal(await send(await draft(e1, F.offer)), null, 'a revision for the couple who has it was refused');
  assert.equal(await taken(F.offer), 1, 'two versions of ONE couple counted twice');
});

test('a declined quote frees the offer for the next couple', async () => {
  await db.query(`UPDATE public.vendor_proposals SET status = 'declined' WHERE vendor_profile_id = $1 AND status IN ('sent', 'accepted')`, [F.shop]);
  assert.equal(await taken(F.offer), 0);
  const e3 = await event('third couple');
  assert.equal(await send(await draft(e3, F.offer)), null);
  assert.equal(await taken(F.offer), 1);
});

test('an offer’s own named line (offer_id) counts the same way', async () => {
  const a = await event('own line a');
  const b = await event('own line b');
  assert.equal(await send(await draft(a, F.offerOwn, 'offer_id')), null);
  const err = await send(await draft(b, F.offerOwn, 'offer_id'));
  assert.ok(err && /OFFER_TAKEN/.test(err), `an offer line went to a second couple: ${err ?? 'sent'}`);
});
