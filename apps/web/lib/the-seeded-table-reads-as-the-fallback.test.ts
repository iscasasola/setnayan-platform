/**
 * 🧩 THE SEEDED TABLE READS AS THE FALLBACK — so step ② changes nothing on screen whichever path answers
 * (PLAN `admin_inspiration_groups_2026-10-25` step ②: "No UI change … the couple and supplier screens must render
 * identically").
 *
 * The labs never reach the database, so their before/after captures prove the FALLBACK path only. This proves the
 * other one: the rows migration `…_inspiration_parts_on_the_taxonomy.sql` seeds, shaped by the reader's own
 * `snapshotFromPartRows`, are part-for-part the snapshot `fallbackInspirationParts()` builds — same keys, names,
 * kinds, homes, also-categories IN ORDER, hidden flags and order. (The db test
 * `inspiration-parts-seed-equals-the-consts.db.test.ts` holds the replayed table equal to the same consts.)
 *
 * 🛡 Sabotaged once (2026-10-26, builder): the reader's `sort_order` sort on the also-categories removed → "…come back
 * in their stored order" red; restored.
 * 🛡 Sabotaged again (2026-11-06, taxonomy v2 re-point): `lights` lost `stylist_decorator` in the consts → both red;
 * restored.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  fallbackInspirationParts,
  snapshotFromPartRows,
  type InspirationPart,
  type InspirationPartCategoryRow,
  type InspirationPartRow,
} from './inspiration-parts';
import { liveTileOf, type WeddingTile } from './taxonomy';

const DIR = join(__dirname, '../../../supabase/migrations');
const sql = readFileSync(join(DIR, readdirSync(DIR).find((f) => f.endsWith('_inspiration_parts_on_the_taxonomy.sql'))!), 'utf8');
const block = (from: string, to: string) => sql.slice(sql.indexOf(from), sql.indexOf(to, sql.indexOf(from)));
const str = (v: string) => (v === 'NULL' ? null : v.replace(/^'|'$/g, '').replace(/''/g, "'"));

/* ③a (20271291224109) relabels one part and hides another — the two recorded controller calls. Read off that
   migration, never re-typed, so the seed + those two UPDATEs is what the replay holds. */
const partServicesSql = readFileSync(join(DIR, readdirSync(DIR).find((f) => f.endsWith('_inspiration_part_services.sql'))!), 'utf8');
const relabel = [...partServicesSql.matchAll(/SET label_en = '((?:[^']|'')*)'\s+WHERE slot_key = '([a-z_]+)'/g)].map((m) => ({ key: m[2]!, label: m[1]!.replace(/''/g, "'") }));
const hide = [...partServicesSql.matchAll(/SET hidden = TRUE\s+WHERE slot_key = '([a-z_]+)'/g)].map((m) => m[1]!);

function seededRows(): { rows: InspirationPartRow[]; links: InspirationPartCategoryRow[] } {
  const rows = [...block('INSERT INTO public.inspiration_parts', 'ON CONFLICT (slot_key)').matchAll(/^\s+\('([a-z_]+)', '((?:[^']|'')*)', '(part|system)', ('[a-z_]+'|NULL), (\d+), (TRUE|FALSE)\)/gm)].map(
    (m) => ({ slot_key: m[1]!, label_en: str(`'${m[2]}'`)!, kind: m[3]!, home_category_id: str(m[4]!), sort_order: Number(m[5]), hidden: m[6] === 'TRUE', status: 'active' }),
  );
  const links = [...block('INSERT INTO public.inspiration_part_categories', 'ON CONFLICT (slot_key, category_id)').matchAll(/^\s+\('([a-z_]+)', '([a-z_]+)', (\d+)\)/gm)].map(
    (m) => ({ slot_key: m[1]!, category_id: m[2]!, sort_order: Number(m[3]) }),
  );
  for (const r of rows) {
    const l = relabel.find((x) => x.key === r.slot_key);
    if (l) r.label_en = l.label;
    if (hide.includes(r.slot_key)) r.hidden = true;
  }
  return { rows, links };
}

/*
 * ⚖ TAXONOMY V2 (2026-11-06) — migration 20271320461004 runs AFTER the seed and folds 40 categories. So the
 * seeded rows are no longer what the replay holds; they are what it holds once every folded category is read as
 * the row it folded into (`liveTileOf`, duplicates dropped, the home never repeated as an also). Five parts then
 * still differ, each for a reason the migration states — nothing else may:
 *   · groom, groomsmen, ring_bearer — step 11: a one-person board keeps only the men's half (the cross-view's
 *     Filipiniana half folded into Gowns & dresses, which is not theirs).
 *   · chairs, centrepieces — the derivation names a linked service by its own row (Chairs' lights rental folded
 *     into the `lights_sound` service; Centrepieces' hotel `accommodation`, once Catering gained Private chef).
 *     These only GAIN an also-from, never lose one.
 */
const V2_ONE_HALF = new Set(['groom', 'groomsmen', 'ring_bearer']);
const V2_REDERIVED = new Set(['chairs', 'centrepieces']);

function forwarded(parts: readonly InspirationPart[]): InspirationPart[] {
  return parts.map((p) => {
    const home = p.homeCategoryId ? liveTileOf(p.homeCategoryId as WeddingTile) : null;
    const also: string[] = [];
    for (const c of p.alsoCategoryIds) {
      const live = liveTileOf(c as WeddingTile);
      if (live !== home && !also.includes(live)) also.push(live);
    }
    return { ...p, homeCategoryId: home, alsoCategoryIds: also };
  });
}

/** The seed read through the v2 forward must be the fallback — part for part, bar the five named above. */
function assertSeedIsFallbackThroughV2(seeded: readonly InspirationPart[]) {
  const fallback = new Map(fallbackInspirationParts().parts.map((p) => [p.slotKey, p] as const));
  const differing: string[] = [];
  for (const p of forwarded(seeded)) {
    const f = fallback.get(p.slotKey);
    assert.ok(f, `${p.slotKey} is seeded but has no fallback part`);
    if (JSON.stringify(p) === JSON.stringify(f)) continue;
    differing.push(p.slotKey);
    assert.deepEqual({ ...p, alsoCategoryIds: [] }, { ...f, alsoCategoryIds: [] }, `${p.slotKey}: only its also-from may differ`);
    if (V2_ONE_HALF.has(p.slotKey)) {
      assert.deepEqual(f.alsoCategoryIds, p.alsoCategoryIds.filter((c) => c !== 'brides_attire'), `${p.slotKey}: lost more than the other half`);
    } else if (V2_REDERIVED.has(p.slotKey)) {
      for (const c of p.alsoCategoryIds) assert.ok(f.alsoCategoryIds.includes(c), `${p.slotKey} lost ${c}`);
    }
  }
  assert.equal(seeded.length, fallback.size, 'the seed and the fallback no longer name the same parts');
  assert.deepEqual(differing.sort(), [...V2_ONE_HALF, ...V2_REDERIVED].sort(), 'a part changed that v2 does not explain');
}

test('⭐ the seeded rows, read by the reader, are the fallback snapshot part for part', () => {
  const { rows, links } = seededRows();
  assert.equal(rows.length, fallbackInspirationParts().parts.length, 'the seed parse is broken, not the guard');
  assert.ok(links.length > 20, 'the also-rows parse is broken, not the guard');
  assert.deepEqual([relabel.map((x) => x.key), hide], [['groom'], ['entourage']], 'the ③a relabel/hide parse is broken, not the guard');
  const fromDb = snapshotFromPartRows(rows, links, null);
  assert.equal(fromDb.source, 'db');
  assertSeedIsFallbackThroughV2(fromDb.parts);
});

test('a retired part is offered nowhere, and the also-categories come back in their stored order', () => {
  const { rows, links } = seededRows();
  const retired = snapshotFromPartRows(rows.map((r) => (r.slot_key === 'cocktail' ? { ...r, status: 'retired' } : r)), links, null);
  assert.ok(!retired.parts.some((p) => p.slotKey === 'cocktail'));
  const shuffled = snapshotFromPartRows(rows, [...links].reverse(), null);
  assert.deepEqual(shuffled.parts, snapshotFromPartRows(rows, links, null).parts, 'the reader trusted row order instead of sort_order');
  assertSeedIsFallbackThroughV2(shuffled.parts);
});
