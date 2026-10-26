/**
 * part-eligibility-is-unchanged-by-the-move.db.test.ts — 🌳 ③a, A PART LINKS SERVICES (owner 2026-10-26, DECISION_LOG
 * "APPROVED — BUILD THE TAXONOMY" decision (3): "backfill = today's category expansion (no shop loses a right)"; corpus
 * prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md § 3 guard (a); migration 20271291224109).
 *
 *   1 · ⭐ OLD = NEW FOR EVERY PART. The backfilled `inspiration_part_services` rows of each part are exactly the services
 *       its categories reached before the move — computed two independent ways: the TS seed expansion the pre-③a app
 *       used (`canonicalServicesForSlot` over the consts) and a JS expansion of the replayed category rows. Nobody may
 *       add a photo who could not, and nobody who could is refused.
 *   2 · THE CATEGORIES ARE DERIVED, AND THEY ARE TODAY'S. `inspiration_part_categories_derived` (what the reader reads)
 *       equals the stored `inspiration_part_categories` and the consts' home + also, in order, for every part — so the
 *       credit line and the "Book a … first" words do not move on ship day.
 *   3 · THE DOUBLE WRITE HOLDS AFTER AN ADMIN EDIT. Link a service from another category, unlink it, re-home a part, add
 *       a service to the taxonomy nobody links, delete a part: after each, the stored table equals the derivation, and
 *       the app's snapshot follows.
 *   4 · THE TABLE IS SHAPED AND FENCED. RLS at CREATE TABLE: a signed-in account reads; anon reaches nothing; nobody but
 *       the service role writes. FKs: a link to no service is refused; a linked service cannot be deleted.
 *   5 · THE TWO RECORDED CALLS. `groom` reads "Groom’s attire" (key unchanged); `entourage` is hidden.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { MOODBOARD_SLOT_KEYS } from '../../lib/moodboard-slots';
import { canonicalServicesForSlot } from '../../lib/moodboard-gallery';
import {
  fallbackInspirationParts,
  inspirationPart,
  partCategories,
  snapshotFromPartRows,
  type InspirationPartCategoryRow,
  type InspirationPartRow,
  type InspirationPartServiceRow,
  type InspirationPartsSnapshot,
} from '../../lib/inspiration-parts';
import { FILIPINIANA_BARONG_CANONICALS } from '../../lib/taxonomy';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
}

async function linksOf(slot: string): Promise<string[]> {
  return (
    await db.query<{ canonical_service: string }>(
      `SELECT canonical_service FROM public.inspiration_part_services WHERE slot_key = $1 ORDER BY canonical_service`,
      [slot],
    )
  ).rows.map((r) => r.canonical_service);
}
async function storedAlso(slot: string): Promise<string[]> {
  return (
    await db.query<{ category_id: string }>(
      `SELECT category_id FROM public.inspiration_part_categories WHERE slot_key = $1 ORDER BY sort_order, category_id`,
      [slot],
    )
  ).rows.map((r) => r.category_id);
}
async function derivedAlso(slot: string): Promise<string[]> {
  return (
    await db.query<{ category_id: string }>(
      `SELECT category_id FROM public.inspiration_part_categories_derived WHERE slot_key = $1 ORDER BY sort_order, category_id`,
      [slot],
    )
  ).rows.map((r) => r.category_id);
}

/** The app's snapshot, shaped by the reader's own function from the rows the reader selects. */
async function appSnapshot(): Promise<InspirationPartsSnapshot> {
  const rows = (await db.query<InspirationPartRow>(`SELECT slot_key,label_en,kind,home_category_id,sort_order,hidden,status FROM public.inspiration_parts`)).rows;
  const cats = (await db.query<InspirationPartCategoryRow>(`SELECT slot_key,category_id,sort_order FROM public.inspiration_part_categories_derived`)).rows;
  const svc = (await db.query<InspirationPartServiceRow>(`SELECT slot_key,canonical_service,sort_order FROM public.inspiration_part_services`)).rows;
  return snapshotFromPartRows(rows, cats, svc);
}

/** After any edit: the stored copy is the derivation, for every part. */
async function assertDoubleWriteHolds(when: string): Promise<void> {
  const keys = (await db.query<{ slot_key: string }>(`SELECT slot_key FROM public.inspiration_parts`)).rows.map((r) => r.slot_key);
  for (const k of keys) assert.deepEqual(await storedAlso(k), await derivedAlso(k), `${when}: inspiration_part_categories('${k}') is not the derivation`);
}

/* ══ 1 · old = new ═══════════════════════════════════════════════════════════ */

test('⭐ 1 · old = new for every part — the backfilled services are exactly what its categories reached', async (t) => {
  /* (a) the JS expansion of the replayed category rows — independent of every SQL function in the migration. */
  const svc = (await db.query<{ canonical_service: string; tile_id: string | null; secondary_tiles: string[] | null; marketplace_hidden: boolean | null }>(
    `SELECT canonical_service, tile_id, secondary_tiles, marketplace_hidden FROM public.canonical_service_taxonomy`,
  )).rows;
  const byCategory = (cat: string): string[] => {
    const out = svc.filter((r) => !r.marketplace_hidden && (r.tile_id === cat || (r.secondary_tiles ?? []).includes(cat))).map((r) => r.canonical_service);
    if (cat === 'filipiniana_barongs') out.push(...FILIPINIANA_BARONG_CANONICALS);
    return out;
  };
  const seed = fallbackInspirationParts();
  let total = 0;
  const counts: string[] = [];
  for (const slot of MOODBOARD_SLOT_KEYS) {
    const now = await linksOf(slot);
    const part = inspirationPart(seed, slot)!;
    /* (b) what the pre-③a app answered: the TS expansion of the consts' categories. */
    const before = [...canonicalServicesForSlot(slot, seed)].sort();
    const fromRows = [...new Set(partCategories(part).flatMap(byCategory))].sort();
    assert.deepEqual(now, before, `${slot}: the shops that may add a photo changed on ship day (TS expansion)`);
    assert.deepEqual(now, fromRows, `${slot}: the shops that may add a photo changed on ship day (the category rows)`);
    if (part.kind === 'part') assert.ok(now.length > 0, `${slot} lost every supplier`);
    total += now.length;
    counts.push(`${slot}=${now.length}`);
  }
  const rows = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.inspiration_part_services`)).rows[0]!.n;
  assert.equal(rows, total, 'a link row belongs to no board key');
  t.diagnostic(`backfill: ${rows} links over ${counts.length} keys — ${counts.join(' ')}`);
});

/* ══ 2 · the categories are derived, and they are today's ═══════════════════ */

test('2 · the derived categories equal the stored ones and the consts, in order, for every part — and the app reads them', async () => {
  const seed = fallbackInspirationParts();
  const app = await appSnapshot();
  for (const slot of MOODBOARD_SLOT_KEYS) {
    const part = inspirationPart(seed, slot)!;
    assert.deepEqual(await derivedAlso(slot), [...part.alsoCategoryIds], `${slot}: the derived also-categories are not today's`);
    assert.deepEqual(await storedAlso(slot), [...part.alsoCategoryIds], `${slot}: the stored also-categories moved`);
    assert.deepEqual(partCategories(inspirationPart(app, slot)), partCategories(part), `${slot}: the app's categories (credit, "Book a …") moved`);
    assert.deepEqual(
      [...canonicalServicesForSlot(slot, app)].sort(),
      [...canonicalServicesForSlot(slot, seed)].sort(),
      `${slot}: the app's DB snapshot and the fallback disagree about who may add a photo`,
    );
  }
  assert.equal(app.source, 'db');
  assert.ok(app.parts.every((p) => p.services !== null), 'the DB snapshot carries no services — the reader did not read the link table');
});

/* ══ 3 · the double write holds after an admin edit ═════════════════════════ */

test('3 · link, unlink, re-home, an unlinked new service, a deleted part — the stored categories stay the derivation', async () => {
  await reset();
  try {
    await assertDoubleWriteHolds('before any edit');

    /* 🧪 SABOTAGE TARGET — link a Cake service to Bridal bouquet: Cake joins its categories, stored and read. */
    await db.query(`INSERT INTO public.inspiration_part_services (slot_key, canonical_service, sort_order) VALUES ('bridal_bouquet','wedding_cake',9000)`);
    await assertDoubleWriteHolds('after linking wedding_cake');
    assert.ok((await storedAlso('bridal_bouquet')).includes('cake'), 'a service from another category did not bring its category');
    assert.ok(partCategories(inspirationPart(await appSnapshot(), 'bridal_bouquet')).includes('cake' as never), 'the app does not read the new category');
    assert.ok(canonicalServicesForSlot('bridal_bouquet', await appSnapshot()).includes('wedding_cake'), 'the app does not read the new service');

    /* Unlink it: back to today's. */
    await db.query(`DELETE FROM public.inspiration_part_services WHERE slot_key='bridal_bouquet' AND canonical_service='wedding_cake'`);
    await assertDoubleWriteHolds('after unlinking wedding_cake');
    assert.deepEqual(await storedAlso('bridal_bouquet'), [], 'unlinking left the category behind');

    /* Re-home Tunnel onto Florist: the services stay; Stylist / Decorator — still fully linked — becomes an also-category. */
    const tunnelBefore = await linksOf('tunnel');
    await db.query(`UPDATE public.inspiration_parts SET home_category_id='florist' WHERE slot_key='tunnel'`);
    await assertDoubleWriteHolds('after re-homing tunnel');
    assert.deepEqual(await linksOf('tunnel'), tunnelBefore, 'a re-home changed who may add a photo');
    assert.deepEqual(await storedAlso('tunnel'), ['stylist_decorator'], 'the old home did not become an also-category');

    /* A new florist service nobody links: Table still names Florist (its other florist services are linked). */
    await db.query(`INSERT INTO public.canonical_service_taxonomy (canonical_service, folder_id, tile_id, phase) VALUES ('moss_wall_florist','design','florist','V1.2')`);
    assert.deepEqual(await derivedAlso('table'), ['florist'], 'adding a service to a category dropped that category from a part that links the rest');
    assert.ok(!(await linksOf('table')).includes('moss_wall_florist'), 'an unlinked service reached a part');

    /* A part with no photo can be deleted: its links go with it. */
    await db.query(`INSERT INTO public.inspiration_parts (slot_key, label_en, kind, home_category_id, sort_order) VALUES ('test_arch','Arch','part','florist',999)`);
    await db.query(`INSERT INTO public.inspiration_part_services (slot_key, canonical_service, sort_order) VALUES ('test_arch','florals',1),('test_arch','stylist_decorator',2)`);
    await assertDoubleWriteHolds('after creating a part');
    await db.query(`DELETE FROM public.inspiration_parts WHERE slot_key='test_arch'`);
    assert.deepEqual(await linksOf('test_arch'), [], 'a deleted part left its service links');
    assert.deepEqual(await storedAlso('test_arch'), [], 'a deleted part left its categories');
  } finally {
    await reset();
    await db.query(`DELETE FROM public.inspiration_parts WHERE slot_key='test_arch'`);
    await db.query(`DELETE FROM public.inspiration_part_services WHERE slot_key='bridal_bouquet' AND canonical_service='wedding_cake'`);
    await db.query(`UPDATE public.inspiration_parts SET home_category_id='stylist_decorator' WHERE slot_key='tunnel'`);
    await db.query(`DELETE FROM public.canonical_service_taxonomy WHERE canonical_service='moss_wall_florist'`);
    await assertDoubleWriteHolds('after undoing every edit');
  }
});

/* ══ 4 · shaped and fenced ══════════════════════════════════════════════════ */

test('4 · a signed-in account reads; anon reaches nothing; nobody but the service role writes; the FKs refuse', async () => {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('part-services@audit.test', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  await setAuthUid(db, u.rows[0]!.id);
  await db.exec(`SET ROLE authenticated`);
  try {
    const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.inspiration_part_services`)).rows[0]!.n;
    assert.ok(n > 100, `a signed-in account read only ${n} links`);
    const v = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.inspiration_part_categories_derived`)).rows[0]!.n;
    assert.ok(v > 10, `a signed-in account read only ${v} derived categories`);
    await assert.rejects(
      db.query(`INSERT INTO public.inspiration_part_services (slot_key, canonical_service) VALUES ('stage','florals')`),
      /permission denied/,
      'a signed-in account wrote a service link',
    );
  } finally {
    await reset();
  }
  await db.exec(`SET ROLE anon`);
  try {
    await assert.rejects(db.query(`SELECT 1 FROM public.inspiration_part_services LIMIT 1`), /permission denied/, 'anon read the link table');
    await assert.rejects(db.query(`SELECT 1 FROM public.inspiration_part_categories_derived LIMIT 1`), /permission denied/, 'anon read the derived view');
  } finally {
    await reset();
  }
  await assert.rejects(
    db.query(`INSERT INTO public.inspiration_part_services (slot_key, canonical_service) VALUES ('stage','no_such_service')`),
    /foreign key/,
    'a link to no service was accepted',
  );
  await assert.rejects(
    db.query(`DELETE FROM public.canonical_service_taxonomy WHERE canonical_service='florals'`),
    /foreign key|violates/,
    'a linked service was deleted out from under its parts',
  );
});

/* ══ 5 · the two recorded calls ═════════════════════════════════════════════ */

test('5 · “Groom’s attire” on the same key; Entourage hidden, its key kept', async () => {
  await reset();
  const r = (await db.query<{ slot_key: string; label_en: string; hidden: boolean }>(
    `SELECT slot_key, label_en, hidden FROM public.inspiration_parts WHERE slot_key IN ('groom','entourage') ORDER BY slot_key`,
  )).rows;
  assert.deepEqual(r, [
    { slot_key: 'entourage', label_en: 'Entourage attire', hidden: true },
    { slot_key: 'groom', label_en: 'Groom’s attire', hidden: false },
  ]);
  /* …and the fallback says the same, so a failed read draws the same words. */
  const f = fallbackInspirationParts();
  assert.equal(inspirationPart(f, 'groom')!.label, 'Groom’s attire');
  assert.equal(inspirationPart(f, 'entourage')!.hidden, true);
});
