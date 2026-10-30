/**
 * an-inspiration-photo-names-its-own-card.db.test.ts — 🔗🖼 THE FOUR-WAY LINK, against the real replayed schema (owner
 * 2026-10-30, DECISION_LOG "A SUPPLIER'S INSPIRATION PHOTO IS CONNECTED FOUR WAYS — ITS SERVICE CARD · THE EVENT · THE
 * SUPPLIER'S WEBSITE · THE CATEGORY/SERVICE POOL"; migration 20271297295494).
 *
 *   1 · THE CARD MUST BE THE UPLOADER'S SHOP. A library photo naming another shop's card is refused by the table (the
 *       trigger — the service role skips RLS, not a trigger); its own card is taken; a card on a non-gallery row is
 *       refused; deleting the card SETS NULL (never blocks the delete). The same on a suggestion, and a suggestion whose
 *       shop goes NULL drops its card instead of raising.
 *   2 · THE GRANTS. A signed-in supplier can READ its photo's card but cannot WRITE it (no column grant) — the server
 *       writes it after `verifyCardForPart`; `source_suggestion_id` is withheld from every public role.
 *   3 · A SUGGESTION ENTERS THE POOL ONLY AS PENDING. Its pool copy (as `importSuggestionToGallery` files it:
 *       approved_at NULL, source_event_id = the suggestion's event) is NOT publicly readable until an admin approves it,
 *       and a suggestion cannot be filed twice.
 *   4 · THE PAGE'S READ (/v/[slug]) — the REAL `fetchShopInspirationLooks`, run over the replayed rows through a client
 *       that turns its predicates into SQL: only this shop's APPROVED, not-retired, not-rejected gallery photos, with
 *       their card — never a draft, a retired or refused one, another shop's, or a non-gallery row.
 *
 * ⚠ "An event-album photo never enters the pool" is NOT a database fact — nothing in the schema marks a suggestion's
 * bytes as album-sourced. It is held at the two doors that can see the ref: `shopOwnPhotoRefs` (album copies are never
 * offered) and `importSuggestionToGallery` (refuses an album ref first) — pinned by
 * `lib/inspiration-four-links.test.ts`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import './supabase-over-pglite';
import { fallbackInspirationParts } from '../../lib/inspiration-parts';

type ShopRead = typeof import('../../lib/shop-inspiration.server');

let replay: ReplayResult;
let db: PGlite;
let SR: ShopRead;

const W = { shopA: '', shopB: '', ownerA: '', ownerB: '', cardA: '', cardA2: '', cardB: '', eventId: '', bookingA: '' };

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asRole(role: 'anon' | 'authenticated', uid: string | null): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
  await db.exec(`SET ROLE ${role}`);
}
async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function shop(owner: string, name: string): Promise<string> {
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['florals']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [owner, name],
  );
  return r.rows[0]!.vendor_profile_id;
}
async function card(vp: string, category: string): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    /* Drafted (is_active FALSE): the publish gates (cover · what's included · the daily limit) are not what this file
       tests, and the trigger holds a card to its shop whether or not it is live — liveness is the app's rule. */
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
     VALUES ($1, $2, 25000, 'Free corsage', FALSE, 'vendor-media/links/cover.jpg') RETURNING vendor_service_id`,
    [vp, category],
  );
  return r.rows[0]!.vendor_service_id;
}
/** A supplier-gallery row as the server files it (service role — here, the owner past RLS). */
async function photo(o: {
  vp: string;
  uploader: string;
  card?: string | null;
  approved?: boolean;
  retired?: boolean;
  rejected?: boolean;
  slot?: string;
  eventId?: string | null;
  suggestionId?: string | null;
  label?: string;
}): Promise<string> {
  await reset();
  const r = await db.query<{ asset_id: string }>(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source, vendor_profile_id, uploaded_by,
        rights_warranted_at, rights_warranty_version, approved_at, retired_at, rejected_at, rejection_reason,
        vendor_service_id, source_event_id, source_suggestion_id)
     VALUES ('supplier_gallery', $1, $2, 'moodboard-library/' || gen_random_uuid() || '.jpg', 'stylist_upload', $3, $4,
             NOW(), 'gallery-rights-v1-2026-09-04',
             CASE WHEN $5 THEN NOW() END, CASE WHEN $6 THEN NOW() END,
             CASE WHEN $7 THEN NOW() END, CASE WHEN $7 THEN 'Not your photo' END,
             $8, $9, $10)
     RETURNING asset_id`,
    [o.slot ?? 'bridal_bouquet', o.label ?? 'look', o.vp, o.uploader, o.approved ?? false, o.retired ?? false, o.rejected ?? false, o.card ?? null, o.eventId ?? null, o.suggestionId ?? null],
  );
  return r.rows[0]!.asset_id;
}
async function rejects(sql: string, params: unknown[], pattern: RegExp, why: string): Promise<void> {
  await assert.rejects(db.query(sql, params), pattern, why);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  SR = await import('../../lib/shop-inspiration.server');
  W.ownerA = await newUser('links-a@audit.test');
  W.ownerB = await newUser('links-b@audit.test');
  W.shopA = await shop(W.ownerA, 'Bloom & Co.');
  W.shopB = await shop(W.ownerB, 'Other Florals');
  W.cardA = await card(W.shopA, 'florals');
  W.cardA2 = await card(W.shopA, 'florist');
  W.cardB = await card(W.shopB, 'florals');
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Links Test', 'birthday') RETURNING event_id`,
  );
  W.eventId = ev.rows[0]!.event_id;
  const b = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, marketplace_vendor_id)
     VALUES ($1, 'Bloom & Co.', 'florist'::public.vendor_category, 'contracted', $2) RETURNING vendor_id`,
    [W.eventId, W.shopA],
  );
  W.bookingA = b.rows[0]!.vendor_id;
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 1 · the card must be the uploader's shop ─────────────────────────────── */

test('1 · a library photo takes ITS OWN shop\'s card, and the table refuses another shop\'s', async () => {
  const own = await photo({ vp: W.shopA, uploader: W.ownerA, card: W.cardA });
  const got = await db.query<{ vendor_service_id: string }>(`SELECT vendor_service_id FROM public.moodboard_library_assets WHERE asset_id=$1`, [own]);
  assert.equal(got.rows[0]!.vendor_service_id, W.cardA);
  await assert.rejects(photo({ vp: W.shopA, uploader: W.ownerA, card: W.cardB }), /not this shop/, 'shop A filed a photo under shop B\'s card');
  /* Moving an existing photo onto another shop's card is the same refusal (the trigger runs on UPDATE OF the column). */
  await rejects(`UPDATE public.moodboard_library_assets SET vendor_service_id=$2 WHERE asset_id=$1`, [own, W.cardB], /not this shop/, 'an UPDATE moved a photo onto another shop\'s card');
  /* A card only ever belongs on a SUPPLIER's inspiration photo. */
  await rejects(
    `INSERT INTO public.moodboard_library_assets (asset_type, label, storage_path, source, vendor_service_id)
     VALUES ('venue_scene', 'x', 'moodboard-library/x.jpg', 'internet_placeholder', $1)`,
    [W.cardA],
    /only a supplier/,
    'a Setnayan template row named a service card',
  );
});

test('1b · deleting the card SETS NULL — it never blocks the delete and never deletes the photo', async () => {
  const doomed = await card(W.shopA, 'photo_booth');
  const p = await photo({ vp: W.shopA, uploader: W.ownerA, card: doomed });
  await db.query(`DELETE FROM public.vendor_services WHERE vendor_service_id=$1`, [doomed]);
  const after = await db.query<{ vendor_service_id: string | null }>(`SELECT vendor_service_id FROM public.moodboard_library_assets WHERE asset_id=$1`, [p]);
  assert.equal(after.rows.length, 1, 'the photo went with its card');
  assert.equal(after.rows[0]!.vendor_service_id, null);
});

test('1c · a suggestion takes only its own shop\'s card; a shop going NULL drops the card instead of raising', async () => {
  await reset();
  const s = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_inspiration_suggestions (event_id, event_vendor_id, vendor_profile_id, shop_label, slot_key, vendor_service_id)
     VALUES ($1, $2, $3, 'Bloom & Co.', 'bridal_bouquet', $4) RETURNING suggestion_id`,
    [W.eventId, W.bookingA, W.shopA, W.cardA],
  );
  const id = s.rows[0]!.suggestion_id;
  await rejects(`UPDATE public.event_inspiration_suggestions SET vendor_service_id=$2 WHERE suggestion_id=$1`, [id, W.cardB], /not this shop/, 'a suggestion was filed under another shop\'s card');
  await db.query(`UPDATE public.event_inspiration_suggestions SET vendor_profile_id=NULL WHERE suggestion_id=$1`, [id]);
  const r = await db.query<{ vendor_service_id: string | null }>(`SELECT vendor_service_id FROM public.event_inspiration_suggestions WHERE suggestion_id=$1`, [id]);
  assert.equal(r.rows[0]!.vendor_service_id, null, 'a shop-less suggestion kept a card');
});

/* ── 2 · the grants ──────────────────────────────────────────────────────── */

test('2 · a signed-in supplier reads its photo\'s card but cannot write it; source_suggestion_id is withheld', async () => {
  const mine = await photo({ vp: W.shopA, uploader: W.ownerA, card: W.cardA });
  /* The supplier's own-row read policy admits a VENDOR account (20260527000000). */
  await db.query(`UPDATE public.users SET account_type='vendor' WHERE user_id=$1`, [W.ownerA]);
  await asRole('authenticated', W.ownerA);
  try {
    const r = await db.query<{ vendor_service_id: string }>(`SELECT vendor_service_id FROM public.moodboard_library_assets WHERE asset_id=$1`, [mine]);
    assert.equal(r.rows[0]?.vendor_service_id, W.cardA, 'the supplier cannot see which card its own photo is filed under');
    await assert.rejects(
      db.query(`UPDATE public.moodboard_library_assets SET vendor_service_id=$2 WHERE asset_id=$1`, [mine, W.cardA2]),
      /permission denied/,
      'a supplier session wrote the card column directly — past verifyCardForPart',
    );
    await assert.rejects(db.query(`SELECT source_suggestion_id FROM public.moodboard_library_assets LIMIT 1`), /permission denied/);
  } finally {
    await reset();
  }
  await asRole('anon', null);
  try {
    await assert.rejects(db.query(`SELECT source_suggestion_id FROM public.moodboard_library_assets LIMIT 1`), /permission denied/);
    await assert.rejects(db.query(`SELECT source_event_id FROM public.moodboard_library_assets LIMIT 1`), /permission denied/);
  } finally {
    await reset();
  }
});

/* ── 3 · a suggestion enters the pool only as pending ─────────────────────── */

test('3 · a suggestion\'s pool copy is PENDING — invisible to the public until approved — and is filed once', async () => {
  await reset();
  const s = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_inspiration_suggestions (event_id, event_vendor_id, vendor_profile_id, shop_label, slot_key, state, image_url, screened_at,
       sampled_hex_1, sampled_hex_2, sampled_hex_3, sampled_hex_4, sampled_hex_5, sampled_hex_6, vendor_service_id)
     VALUES ($1, $2, $3, 'Bloom & Co.', 'bridal_bouquet', 'waiting', 'https://media.example/s.jpg', NOW(),
       '#111111','#222222','#333333','#444444','#555555','#666666', $4) RETURNING suggestion_id`,
    [W.eventId, W.bookingA, W.shopA, W.cardA],
  );
  const sid = s.rows[0]!.suggestion_id;
  /* What importSuggestionToGallery writes: no approved_at, the event, the card, the suggestion. */
  const pool = await photo({ vp: W.shopA, uploader: W.ownerA, card: W.cardA, eventId: W.eventId, suggestionId: sid, label: 'from a suggestion' });
  const publicSees = async (): Promise<boolean> => {
    await asRole('anon', null);
    try {
      const r = await db.query(`SELECT asset_id FROM public.moodboard_library_assets WHERE asset_id=$1`, [pool]);
      return r.rows.length === 1;
    } finally {
      await reset();
    }
  };
  assert.equal(await publicSees(), false, 'a pending pool copy of a suggestion is publicly readable before an admin approved it');
  await db.query(`UPDATE public.moodboard_library_assets SET approved_at=NOW() WHERE asset_id=$1`, [pool]);
  assert.equal(await publicSees(), true, 'the approved copy never reached the pool');
  /* It stays event-linked (the "event" of the four links) — the boolean only, never which event. */
  const linked = await db.query<{ is_event_linked: boolean }>(`SELECT is_event_linked FROM public.moodboard_library_assets WHERE asset_id=$1`, [pool]);
  assert.equal(linked.rows[0]!.is_event_linked, true);
  /* One pool row per suggestion. */
  await assert.rejects(photo({ vp: W.shopA, uploader: W.ownerA, suggestionId: sid }), /one_per_suggestion|duplicate key/, 'a suggestion was filed into the pool twice');
});

/* ── 4 · the page's read ─────────────────────────────────────────────────── */

/** The REAL read's predicates, turned into SQL over the replayed rows (owner role: the page reads on the service role). */
function sqlClient(): import('../../lib/shop-inspiration.server').ShopInspirationClient {
  return {
    from: () => ({
      select: (columns: string) => {
        const where: string[] = [];
        const params: unknown[] = [];
        const order: string[] = [];
        const q = {
          eq(column: string, value: string) {
            params.push(value);
            where.push(`${column} = $${params.length}`);
            return q;
          },
          not(column: string, _op: 'is', _value: null) {
            where.push(`${column} IS NOT NULL`);
            return q;
          },
          is(column: string, _value: null) {
            where.push(`${column} IS NULL`);
            return q;
          },
          order(column: string, o: { ascending: boolean }) {
            order.push(`${column} ${o.ascending ? 'ASC' : 'DESC'}`);
            return q;
          },
          async range(from: number, to: number) {
            await reset();
            const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const ob = order.length ? `ORDER BY ${order.join(', ')}` : '';
            const total = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.moodboard_library_assets ${w}`, params);
            const rows = await db.query(`SELECT ${columns} FROM public.moodboard_library_assets ${w} ${ob} LIMIT ${to - from + 1} OFFSET ${from}`, params);
            return { data: rows.rows as unknown[], error: null, count: total.rows[0]!.n };
          },
        };
        return q;
      },
    }),
  };
}

test('4 · /v/[slug] reads only this shop\'s APPROVED, live gallery photos — with their card', async () => {
  const ownerC = await newUser('links-c@audit.test');
  const shopC = await shop(ownerC, 'Page Read Shop');
  const cardC = await card(shopC, 'florals');
  const shown = await photo({ vp: shopC, uploader: ownerC, card: cardC, approved: true, label: 'shown' });
  const shownShopOnly = await photo({ vp: shopC, uploader: ownerC, approved: true, slot: 'stage', label: 'shown-shop-only' });
  await photo({ vp: shopC, uploader: ownerC, label: 'draft' });
  await photo({ vp: shopC, uploader: ownerC, approved: true, retired: true, label: 'retired' });
  await photo({ vp: shopC, uploader: ownerC, approved: true, rejected: true, label: 'rejected' });
  await photo({ vp: W.shopB, uploader: W.ownerB, approved: true, label: 'another shop' });
  await reset();
  await db.query(
    `INSERT INTO public.moodboard_library_assets (asset_type, label, storage_path, source, approved_at, vendor_profile_id)
     VALUES ('venue_scene', 'template', 'moodboard-library/t.jpg', 'internet_placeholder', NOW(), NULL)`,
  );

  const looks = await SR.fetchShopInspirationLooks(sqlClient(), shopC, fallbackInspirationParts());
  assert.ok(looks, 'the read did not finish');
  assert.deepEqual(new Set(looks.map((l) => l.id)), new Set([shown, shownShopOnly]), 'the page shows a draft, a retired / refused photo or another shop\'s');
  const withCard = looks.find((l) => l.id === shown)!;
  assert.equal(withCard.vendorServiceId, cardC);
  assert.equal(looks.find((l) => l.id === shownShopOnly)!.vendorServiceId, null);
  assert.ok(withCard.url.endsWith('.jpg'), 'the look has no address a browser can load');
  /* And the card's own strip groups by card. */
  assert.deepEqual([...SR.looksByCard(looks).keys()], [cardC]);
});

test('4b · past one page: the read is paged to the end, never cut at the first window', async () => {
  const ownerD = await newUser('links-d@audit.test');
  const shopD = await shop(ownerD, 'Paged Shop');
  const n = SR.SHOP_INSPIRATION_PAGE + 7;
  await reset();
  await db.query(
    `INSERT INTO public.moodboard_library_assets
       (asset_type, asset_subtype, label, storage_path, source, vendor_profile_id, uploaded_by, rights_warranted_at, rights_warranty_version, approved_at)
     SELECT 'supplier_gallery', 'bridal_bouquet', 'p' || g, 'moodboard-library/p' || g || '.jpg', 'stylist_upload', $1, $2, NOW(), 'v1', NOW()
       FROM generate_series(1, $3::int) g`,
    [shopD, ownerD, n],
  );
  const looks = await SR.fetchShopInspirationLooks(sqlClient(), shopD, fallbackInspirationParts());
  assert.equal(looks?.length, n, 'the page stopped at the first window');
});
