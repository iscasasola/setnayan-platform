/**
 * taxonomy-read-is-honest.test.ts — 🔒 a refused Availability read is UNKNOWN, never "Not set" (Availability plan,
 * step 2). Same disease as guests-read-is-honest.test.ts: a refused read that renders byte-identical to a genuinely
 * empty column ("281 services have no Availability set") would send the admin to re-set work already done.
 *
 * Behaviour is tested against a stubbed client: the real `readTaxonomyFrom` (what `getTaxonomy()` runs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readTaxonomyFrom } from './taxonomy-read';
import { availabilityOf } from './taxonomy-snapshot';

const CATS = [
  { id: 'photo_video', parent_id: null, tier: 1, label_en: 'Photo & video', label_short: null, slug: 'photo-video', sort_order: 0, applicable_event_types: null, icon_name: null, sample_photo_r2_key: null, marketplace_hidden: false, coarse_category: null, hint_en: null },
  { id: 'photography', parent_id: 'photo_video', tier: 2, label_en: 'Photography', label_short: null, slug: 'photography', sort_order: 0, applicable_event_types: null, icon_name: null, sample_photo_r2_key: null, marketplace_hidden: false, coarse_category: null, hint_en: null },
];
const MAP = (withStyle: boolean) =>
  [
    { canonical_service: 'wedding_photographer', availability_style: 'day' },
    { canonical_service: 'photo_booth', availability_style: null },
  ].map(({ canonical_service, availability_style }) => ({
    canonical_service,
    folder_id: 'photo_video',
    tile_id: 'photography',
    phase: 'V1.1 base',
    faith: null,
    is_ph: false,
    is_setnayan: false,
    is_rental: false,
    dietary: null,
    is_tradition: false,
    marketplace_hidden: false,
    secondary_tiles: [],
    ...(withStyle ? { availability_style } : {}),
  }));

/** A client whose mapping read REFUSES any select naming `availability_style` (a build ahead of its column, RLS, …). */
function stub({ refuseAvailability }: { refuseAvailability: boolean }) {
  const selects: string[] = [];
  const client = {
    from(table: string) {
      return {
        select(cols: string) {
          selects.push(`${table}:${cols}`);
          const result =
            table === 'service_categories'
              ? { data: CATS, error: null }
              : refuseAvailability && cols.includes('availability_style')
                ? { data: null, error: { message: 'column canonical_service_taxonomy.availability_style does not exist' } }
                : { data: MAP(cols.includes('availability_style')), error: null };
          const p = Promise.resolve(result) as Promise<typeof result> & { lte: () => Promise<typeof result> };
          p.lte = () => Promise.resolve(result);
          return p;
        },
      };
    },
  };
  return { client: client as never, selects };
}

test('a read WITH the column says each service as it is: a style, or Not set (null)', async () => {
  const { client } = stub({ refuseAvailability: false });
  const snap = await readTaxonomyFrom(client);
  assert.equal(snap.source, 'db');
  assert.equal(availabilityOf(snap, 'wedding_photographer'), 'day');
  assert.equal(availabilityOf(snap, 'photo_booth'), null, 'an unset service is Not set (null) — never day');
});

test('a REFUSED availability read keeps the tree and says UNKNOWN — not "Not set" for every service', async () => {
  const { client, selects } = stub({ refuseAvailability: true });
  const snap = await readTaxonomyFrom(client);
  assert.equal(snap.source, 'db', 'the refused column took the whole tree down to the fallback');
  assert.ok(snap.map.wedding_photographer, 'the services were lost with the column');
  assert.equal(snap.serviceAvailability, null);
  assert.equal(availabilityOf(snap, 'wedding_photographer'), undefined, 'a refused read was drawn as a value');
  assert.equal(availabilityOf(snap, 'photo_booth'), undefined, 'a refused read was drawn as Not set');
  assert.ok(selects.some((s) => s.startsWith('canonical_service_taxonomy:') && !s.includes('availability_style')), 'no retry without the column');
});

test('the constant fallback knows nothing of Availability — unknown, not Not set', async () => {
  const snap = await readTaxonomyFrom(null);
  assert.equal(snap.source, 'fallback');
  assert.equal(availabilityOf(snap, 'wedding_photographer'), undefined);
});
