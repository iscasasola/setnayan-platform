/**
 * 🏷 A DROPPED OFFER IS A CARD THE COUPLE APPLIES — migration 20271339379038, replayed (PGlite).
 *
 *   1 · the marker: only THIS conversation's supplier's offer, dropped by that shop's own team, with a Good-until
 *       day — proven as a real `authenticated` session (SET ROLE + JWT claims), each refusal beside a positive control;
 *   2 · apply_dropped_offer: refuses an EXPIRED DROP and an ENDED OFFER; keeps the PREDECESSOR'S STATUS (a sent quote
 *       stays sent, an accepted one stays accepted — never reset, never promoted); writes exactly one new version =
 *       the old lines + one offer line; refuses a second apply; refuses a reshaped version; a PAID plan row never
 *       changes; only the service role may call it.
 *
 * SABOTAGE (seen red, restored — PR body): drop the OFFER_DROP_EXPIRED check; drop the OFFER_ENDED check; insert the
 * new version with status 'sent' instead of v_quote.status; drop the PAID_ROW_CHANGED loop.
 * Run from apps/web: npx tsx --test tests/db/a-dropped-offer-is-a-card-the-couple-applies.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { resolveSchedule } from '../../lib/proposal-payment-schedule';

let replay: ReplayResult;
let db: PGlite;

const F = {
  couple: '',
  vendorUser: '',
  rivalUser: '',
  shop: '',
  rival: '',
};

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}
async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0]!;
}
const TODAY = `(NOW() AT TIME ZONE 'Asia/Manila')::date`;

/** A fresh event + couple seat + thread + quote, so each scenario owns its own quote. */
async function scenario(tag: string, opts: { status: 'sent' | 'accepted'; schedule?: unknown; total?: number } ) {
  const eventId = (await one<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`, [tag])).event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, F.couple]);
  const threadId = (
    await one<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
      [eventId, F.shop, F.couple],
    )
  ).thread_id;
  const total = opts.total ?? 11000000;
  const lines = [
    { label: 'Garden buffet', detail: null, amount_centavos: 9000000, card_id: 'card-buffet' },
    { label: 'Cocktail hour', detail: null, amount_centavos: 2000000, card_id: 'card-cocktail' },
  ];
  const proposalId = (
    await one<{ proposal_id: string }>(
      `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, line_items, payment_schedule, status, sent_at, valid_until)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'sent', NOW() - interval '1 day', ${TODAY} + 7) RETURNING proposal_id`,
      [F.shop, eventId, `${tag} quote`, total, JSON.stringify(lines), JSON.stringify(opts.schedule ?? {})],
    )
  ).proposal_id;
  if (opts.status === 'accepted') await db.query(`UPDATE public.vendor_proposals SET status = 'accepted', resolved_at = NOW() WHERE proposal_id = $1`, [proposalId]);
  return { eventId, threadId, proposalId, lines, total };
}

async function mkOffer(shop: string, extra = ''): Promise<{ id: number; publicId: string }> {
  return one<{ id: number; publicId: string }>(
    `INSERT INTO public.vendor_offers (vendor_profile_id, name, pct_off ${extra ? ', ' + extra.split('=')[0] : ''})
     VALUES ($1, 'Rainy-season weekday', 10 ${extra ? ', ' + extra.split('=')[1] : ''}) RETURNING id, public_id AS "publicId"`,
    [shop],
  );
}

/** Drop as the supplier (their own session). Returns the error text or the new message id. */
async function drop(uid: string, s: { eventId: string; threadId: string }, shop: string, offerId: number, until: string | null): Promise<{ err: string | null; id: string | null }> {
  try {
    await asUser(uid);
    const r = await db.query<{ message_id: string }>(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, vendor_offer_id, offer_good_until)
       VALUES ($1, $2, $3, '🏷 Offer', $4, ${until === null ? 'NULL' : until}) RETURNING message_id`,
      [s.threadId, s.eventId, shop, offerId],
    );
    return { err: null, id: r.rows[0]!.message_id };
  } catch (e) {
    return { err: e instanceof Error ? e.message : String(e), id: null };
  } finally {
    await reset();
  }
}

/** The server action's write, as the service role would make it: old lines + one offer line. */
async function apply(messageId: string, s: { lines: unknown[]; total: number }, publicId: string, offCentavos: number, schedule: unknown = null, actor = F.couple): Promise<string | null> {
  const lines = [...s.lines, { label: 'Rainy-season weekday', detail: '10% off · offer', amount_centavos: -offCentavos, offer_id: publicId }];
  try {
    await db.query(`SELECT public.apply_dropped_offer($1, $2, $3::jsonb, $4, $5::jsonb)`, [messageId, actor, JSON.stringify(lines), s.total - offCentavos, schedule === null ? null : JSON.stringify(schedule)]);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function versionsOf(eventId: string): Promise<{ proposal_id: string; status: string; total_centavos: number; line_items: { offer_id?: string }[] }[]> {
  return (await db.query<{ proposal_id: string; status: string; total_centavos: number; line_items: { offer_id?: string }[] }>(
    `SELECT proposal_id, status, total_centavos, line_items FROM public.vendor_proposals WHERE event_id = $1 ORDER BY created_at, proposal_id`,
    [eventId],
  )).rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string, t: string) =>
    (await one<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`, [email, t])).id;
  F.couple = await mkUser('offer-couple@chat.test', 'customer');
  F.vendorUser = await mkUser('offer-vendor@chat.test', 'vendor');
  F.rivalUser = await mkUser('offer-rival@chat.test', 'vendor');
  const mkShop = async (uid: string, name: string) =>
    (await one<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
      [uid, name],
    )).vendor_profile_id;
  F.shop = await mkShop(F.vendorUser, 'Rosa’s Kitchen');
  F.rival = await mkShop(F.rivalUser, 'The Rival Kitchen');
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 1 · the marker ─────────────────────────────────────────────────────── */

test('the drop: own offer + Good-until lands; a rival’s offer, a couple’s drop, no day and a past day are refused', async () => {
  const s = await scenario('marker', { status: 'sent' });
  const mine = await mkOffer(F.shop);
  const theirs = await mkOffer(F.rival);
  const ok = await drop(F.vendorUser, s, F.shop, mine.id, `${TODAY} + 3`);
  assert.equal(ok.err, null, `the honest drop was refused: ${ok.err}`);
  assert.match((await drop(F.vendorUser, s, F.shop, theirs.id, `${TODAY} + 3`)).err ?? '', /CARD_NOT_THIS_CONVERSATION/);
  assert.match((await drop(F.couple, s, F.shop, mine.id, `${TODAY} + 3`)).err ?? '', /OFFER_NOT_YOURS/);
  assert.match((await drop(F.vendorUser, s, F.shop, mine.id, null)).err ?? '', /OFFER_NEEDS_GOOD_UNTIL/);
  assert.match((await drop(F.vendorUser, s, F.shop, mine.id, `${TODAY} - 1`)).err ?? '', /OFFER_NEEDS_GOOD_UNTIL/);
  const n = await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages WHERE vendor_offer_id IS NOT NULL AND thread_id = $1`, [s.threadId]);
  assert.equal(n.n, 1, 'a refused drop landed anyway');
});

test('a deleted offer leaves the message (ON DELETE SET NULL), it just stops naming the offer', async () => {
  const s = await scenario('deleted', { status: 'sent' });
  const o = await mkOffer(F.shop);
  const d = await drop(F.vendorUser, s, F.shop, o.id, `${TODAY} + 3`);
  await db.query(`DELETE FROM public.vendor_offers WHERE id = $1`, [o.id]);
  const m = await one<{ vendor_offer_id: number | null; body: string }>(`SELECT vendor_offer_id, body FROM public.chat_messages WHERE message_id = $1`, [d.id]);
  assert.equal(m.vendor_offer_id, null);
});

/* ── 2 · apply ──────────────────────────────────────────────────────────── */

test('🔒 Apply refuses an EXPIRED DROP — and the same drop, still in date, applies (positive control)', async () => {
  const s = await scenario('expired-drop', { status: 'sent' });
  const o = await mkOffer(F.shop);
  const d = await drop(F.vendorUser, s, F.shop, o.id, `${TODAY} + 3`);
  // Time passes: the day moves into the past (the trigger refuses a past day from a session, so the setup steps round it).
  await db.exec(`ALTER TABLE public.chat_messages DISABLE TRIGGER chat_messages_offer_is_this_suppliers`);
  await db.query(`UPDATE public.chat_messages SET offer_good_until = ${TODAY} - 1 WHERE message_id = $1`, [d.id]);
  await db.exec(`ALTER TABLE public.chat_messages ENABLE TRIGGER chat_messages_offer_is_this_suppliers`);
  assert.match((await apply(d.id!, s, o.publicId, 900000)) ?? '', /OFFER_DROP_EXPIRED/);
  assert.equal((await versionsOf(s.eventId)).length, 1, 'a refused apply wrote a version');
  await db.query(`UPDATE public.chat_messages SET offer_good_until = ${TODAY} WHERE message_id = $1`, [d.id]);
  assert.equal(await apply(d.id!, s, o.publicId, 900000), null, 'the last good day must still apply');
});

test('🔒 Apply refuses an ENDED OFFER — switched off, or past its own last day', async () => {
  const s = await scenario('ended-offer', { status: 'sent' });
  const off = await mkOffer(F.shop);
  const d1 = await drop(F.vendorUser, s, F.shop, off.id, `${TODAY} + 3`);
  await db.query(`UPDATE public.vendor_offers SET is_on = FALSE WHERE id = $1`, [off.id]);
  assert.match((await apply(d1.id!, s, off.publicId, 900000)) ?? '', /OFFER_ENDED/);
  const past = await mkOffer(F.shop);
  const d2 = await drop(F.vendorUser, s, F.shop, past.id, `${TODAY} + 3`);
  await db.query(`UPDATE public.vendor_offers SET until_date = ${TODAY} - 1 WHERE id = $1`, [past.id]);
  assert.match((await apply(d2.id!, s, past.publicId, 900000)) ?? '', /OFFER_ENDED/);
  assert.equal((await versionsOf(s.eventId)).length, 1, 'a refused apply wrote a version');
});

test('🔒 applying keeps the predecessor’s status: a SENT quote’s new version is sent; an ACCEPTED one stays accepted', async () => {
  for (const status of ['sent', 'accepted'] as const) {
    const s = await scenario(`keeps-${status}`, { status });
    const o = await mkOffer(F.shop);
    const d = await drop(F.vendorUser, s, F.shop, o.id, `${TODAY} + 3`);
    assert.equal(await apply(d.id!, s, o.publicId, 900000), null);
    const vs = await versionsOf(s.eventId);
    assert.equal(vs.length, 2, 'not exactly one new version');
    assert.equal(vs[0]!.status, 'superseded', 'the predecessor is still live — two live quotes');
    assert.equal(vs[1]!.status, status, `a ${status} quote's new version became ${vs[1]!.status}`);
    assert.equal(Number(vs[1]!.total_centavos), s.total - 900000);
    assert.equal(vs[1]!.line_items.filter((l) => l.offer_id === o.publicId).length, 1, 'applied is not readable from the new version’s lines');
    const card = await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages WHERE proposal_id = $1 AND sender_role = 'system'`, [vs[1]!.proposal_id]);
    assert.equal(card.n, 1, 'the new version was not posted into the chat');
    assert.match((await apply(d.id!, { lines: vs[1]!.line_items, total: Number(vs[1]!.total_centavos) }, o.publicId, 100)) ?? '', /ALREADY_APPLIED/);
  }
});

test('the version is the old lines + ONE offer line, or nothing: a changed line, a positive line, a wrong total are refused', async () => {
  const s = await scenario('shape', { status: 'sent' });
  const o = await mkOffer(F.shop);
  const d = await drop(F.vendorUser, s, F.shop, o.id, `${TODAY} + 3`);
  const cheaper = { lines: [{ ...s.lines[0]!, amount_centavos: 100 }, s.lines[1]!], total: s.total };
  assert.match((await apply(d.id!, cheaper, o.publicId, 900000)) ?? '', /BAD_VERSION/);
  assert.match((await apply(d.id!, s, o.publicId, -500)) ?? '', /BAD_VERSION/, 'a positive "offer" line was taken');
  const lines = [...s.lines, { label: 'x', amount_centavos: -900000, offer_id: o.publicId }];
  await assert.rejects(
    db.query(`SELECT public.apply_dropped_offer($1, $2, $3::jsonb, $4, NULL)`, [d.id, F.couple, JSON.stringify(lines), s.total - 1]),
    /BAD_VERSION/,
  );
  assert.equal((await versionsOf(s.eventId)).length, 1);
});

test('only the couple applies, and only through the service role', async () => {
  const s = await scenario('who', { status: 'sent' });
  const o = await mkOffer(F.shop);
  const d = await drop(F.vendorUser, s, F.shop, o.id, `${TODAY} + 3`);
  assert.match((await apply(d.id!, s, o.publicId, 900000, null, F.vendorUser)) ?? '', /NOT_THE_COUPLE/);
  await asUser(F.couple);
  await assert.rejects(
    db.query(`SELECT public.apply_dropped_offer($1, $2, '[]'::jsonb, 0, NULL)`, [d.id, F.couple]),
    /permission denied/i,
    'a browser session can call the writer and name its own price',
  );
  await reset();
});

test('🔒 a PAID plan row never changes — the writer refuses a version that moves it; frozen, it applies', async () => {
  const total = 11000000;
  const plan = (base: number, frozenReservation: number | null) =>
    resolveSchedule({
      manual: [
        frozenReservation == null
          ? { label: 'Reservation', kind: 'percent', amountPhp: null, percent: 30, due: 'on_lock', offsetDays: 0 }
          : { label: 'Reservation', kind: 'fixed', amountPhp: frozenReservation / 100, percent: null, due: 'on_lock', offsetDays: 0 },
      ],
      autoBalance: { label: 'Final balance', due: 'before_event', offsetDays: 30 },
      baseCentavos: base,
      creditCentavos: 0,
    });
  const before = plan(total, null);
  const s = await scenario('paid', { status: 'sent', schedule: before, total });
  const ev = await one<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id, status) VALUES ($1, 'photographer', 'Rosa', $2, 'shortlisted') RETURNING vendor_id`,
    [s.eventId, F.shop],
  );
  await db.query(
    `INSERT INTO public.event_vendor_payments (vendor_id, amount_php, paid_at, vendor_confirmed_at, schedule_instance_seq) VALUES ($1, 33000, NOW(), NOW(), 0)`,
    [ev.vendor_id],
  );
  const o = await mkOffer(F.shop);
  const d = await drop(F.vendorUser, s, F.shop, o.id, `${TODAY} + 3`);
  const off = 900000;
  assert.match((await apply(d.id!, s, o.publicId, off, plan(total - off, null))) ?? '', /PAID_ROW_CHANGED/, 'a re-split paid row was accepted');
  const reservation = before.installments.find((r) => r.seq === 0)!.amount_centavos;
  assert.equal(await apply(d.id!, s, o.publicId, off, plan(total - off, reservation)), null, 'a frozen paid row was refused');
});
