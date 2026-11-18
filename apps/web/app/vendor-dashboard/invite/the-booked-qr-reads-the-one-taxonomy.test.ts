/**
 * 🔳 THE BOOKED QR READS THE ONE TAXONOMY — AND KEEPS WHAT WAS TYPED WHEN IT REFUSES (W1 RW-378, live 027f641).
 *
 * Generate refused with "Pick at least one service you actually offer." for a shop's REAL services: `issueLockedQr`
 * compared `vendor_services.category` (a taxonomy id — tile or leaf) to `VENDOR_CATEGORIES` (the coarse enum) by
 * spelling. Prod, read 2026-11-16 (`select category, count(*) from vendor_services group by 1`): 7 services, and 6 of
 * them — `lights_sound` ×3, `photo_booth`, `photoman`, `florals` — are not enum spellings, so all 6 were refused. The
 * fix reads the ONE source the services were made from (`canonical_service_taxonomy` → `service_categories
 * .coarse_category`, via `getTaxonomy()`), through the resolver the couple-side writers already use. No spelling map.
 *
 * And a refusal wiped the form. Now the form writes its unsent draft as it submits and a refused arrival opens it
 * filled from the draft (`lib/locked-qr-draft.ts`).
 *
 * The rows below mirror prod's taxonomy rows for exactly those kinds (same ids, tiles, folders, coarse categories).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { snapshotFromRows, type CategoryRow, type MapRow } from '@/lib/taxonomy-snapshot';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { lockedQrCategoryOf } from '@/lib/locked-qr-category';
import {
  LOCKED_QR_DRAFT_KEY,
  LOCKED_QR_DRAFT_MAX_AGE_MS,
  clearLockedQrDraft,
  lockedQrInitialFromDraft,
  saveLockedQrDraft,
  takeLockedQrDraft,
  type LockedQrDraft,
} from '@/lib/locked-qr-draft';

const WEB = path.join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));

/* ── prod's rows for the kinds prod's services carry ── */
const cat = (id: string, parent: string | null, tier: number, coarse: string | null): CategoryRow => ({
  id,
  parent_id: parent,
  tier,
  label_en: id,
  label_short: null,
  slug: id,
  sort_order: 0,
  applicable_event_types: null,
  icon_name: null,
  sample_photo_r2_key: null,
  marketplace_hidden: false,
  coarse_category: coarse,
});
const leaf = (canonical: string, folder: string, tile: string): MapRow => ({
  canonical_service: canonical,
  folder_id: folder,
  tile_id: tile,
  phase: 'planning',
  faith: null,
  is_ph: false,
  is_setnayan: false,
  is_rental: false,
  dietary: null,
  is_tradition: false,
  marketplace_hidden: false,
  secondary_tiles: null,
});
const TAX = snapshotFromRows(
  [
    cat('design', null, 1, null),
    cat('booths', null, 1, null),
    cat('florist', 'design', 2, 'florist'),
    cat('lights_sound', 'design', 2, 'lights_and_sound'),
    cat('mobile_bar', 'booths', 2, 'mobile_bar'),
    cat('photo_booth', 'booths', 2, 'photobooth'),
  ],
  [
    leaf('florals', 'design', 'florist'),
    leaf('lights_sound', 'design', 'lights_sound'),
    leaf('mobile_bar', 'booths', 'mobile_bar'),
    leaf('photo_booth', 'booths', 'photo_booth'),
    leaf('photoman', 'booths', 'photo_booth'),
  ],
);

/** Every prod service kind, with how many services carry it and the enum its own taxonomy row gives. */
const PROD: Array<{ kind: string; services: number; coarse: VendorCategory }> = [
  { kind: 'lights_sound', services: 3, coarse: 'lights_and_sound' },
  { kind: 'photo_booth', services: 1, coarse: 'photobooth' },
  { kind: 'photoman', services: 1, coarse: 'photobooth' },
  { kind: 'florals', services: 1, coarse: 'florist' },
  { kind: 'mobile_bar', services: 1, coarse: 'mobile_bar' },
];

test('main refused 6 of prod’s 7 services — the spelling check this replaces, measured', () => {
  const refusedByMain = PROD.filter((p) => !VENDOR_CATEGORIES.includes(p.kind as VendorCategory));
  const n = refusedByMain.reduce((t, p) => t + p.services, 0);
  console.log(`  main's spelling check refuses ${n} of 7 prod services: ${refusedByMain.map((p) => `${p.kind}×${p.services}`).join(', ')}`);
  assert.equal(n, 6);
});

for (const p of PROD) {
  test(`a "${p.kind}" service makes a Booked QR (→ ${p.coarse})`, () => {
    const svc = { vendor_service_id: `svc-${p.kind}`, category: p.kind };
    // Coverage is deliberately EMPTY: the shop's own service row is the proof it offers it.
    assert.equal(lockedQrCategoryOf(svc.vendor_service_id, [svc], [], TAX), p.coarse);
    assert.ok(VENDOR_CATEGORIES.includes(p.coarse), 'the token stores an enum value — the scan casts it');
  });
}

test('still refused: a ref that is not the shop’s service and not its coverage', () => {
  const svc = { vendor_service_id: 'svc-1', category: 'lights_sound' };
  assert.equal(lockedQrCategoryOf('svc-someone-else', [svc], ['photobooth'], TAX), null);
  assert.equal(lockedQrCategoryOf('catering', [svc], ['photobooth'], TAX), null, 'a key outside coverage');
  assert.equal(lockedQrCategoryOf('photobooth', [svc], ['photobooth'], TAX), 'photobooth', 'a covered key (no services)');
  assert.equal(lockedQrCategoryOf('svc-blank', [{ vendor_service_id: 'svc-blank', category: '  ' }], [], TAX), null);
});

test('issueLockedQr resolves through lockedQrCategoryOf + getTaxonomy, never by spelling', () => {
  const src = read('app/vendor-dashboard/invite/actions.ts');
  const body = src.slice(src.indexOf('export async function issueLockedQr'));
  assert.match(body, /const tax = await getTaxonomy\(\)/);
  assert.match(body, /lockedQrCategoryOf\(ref, activeServices, coverage, tax\)/);
  assert.doesNotMatch(src, /VENDOR_CATEGORIES\.includes/, 'the spelling check is gone');
});

/* ── the form keeps what was typed ── */

function memoryStore() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const TYPED: LockedQrDraft = {
  blockId: null,
  replaces: null,
  clientName: 'Maria Santos',
  eventType: 'wedding',
  serviceRefs: ['svc-lights_sound', 'svc-photoman'],
  eventDate: '2027-02-14',
  description: 'Lights and a roaming photo booth',
  contractId: 'ct-1',
  total: '85000',
  initialPaid: '20000',
  schedule: [
    { label: 'Downpayment', amount: '20000', date: '2026-12-01' },
    { label: 'Balance', amount: '65000', date: '2027-02-01' },
  ],
  lines: [
    { label: 'Lights & sound', amount: '60000' },
    { label: 'Photoman', amount: '25000' },
  ],
  proofRef: 'r2://thread-files/proof.jpg',
  remembranceRef: 'r2://thread-files/us.jpg',
};

test('a refused Generate reopens the form with every field it was sent with', () => {
  const store = memoryStore();
  const now = 1_800_000_000_000;
  saveLockedQrDraft(store, TYPED, now);
  const back = takeLockedQrDraft(store, null, now + 2_000);
  assert.deepEqual(back, TYPED);
  assert.deepEqual(lockedQrInitialFromDraft(back!), {
    replaces: '',
    clientName: 'Maria Santos',
    eventType: 'wedding',
    eventDate: '2027-02-14',
    description: 'Lights and a roaming photo booth',
    serviceRefs: ['svc-lights_sound', 'svc-photoman'],
    contractId: 'ct-1',
    total: '85000',
    initialPaid: '20000',
    schedule: TYPED.schedule,
    lines: [
      { label: 'Lights & sound', detail: null, amount_centavos: 6_000_000 },
      { label: 'Photoman', detail: null, amount_centavos: 2_500_000 },
    ],
    proofRef: 'r2://thread-files/proof.jpg',
    remembranceRef: 'r2://thread-files/us.jpg',
  });
  assert.equal(store.m.has(LOCKED_QR_DRAFT_KEY), false, 'taken once');
});

test('a draft never fills the wrong form: another booking, a stale one, or no storage', () => {
  const store = memoryStore();
  const now = 1_800_000_000_000;
  saveLockedQrDraft(store, TYPED, now);
  assert.equal(takeLockedQrDraft(store, 'block-other', now), null);
  saveLockedQrDraft(store, TYPED, now);
  assert.equal(takeLockedQrDraft(store, null, now + LOCKED_QR_DRAFT_MAX_AGE_MS + 1), null);
  saveLockedQrDraft(store, TYPED, now);
  clearLockedQrDraft(store);
  assert.equal(takeLockedQrDraft(store, null, now), null);
  assert.doesNotThrow(() => saveLockedQrDraft(null, TYPED, now));
  assert.equal(takeLockedQrDraft(null, null, now), null);
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.doesNotThrow(() => saveLockedQrDraft(throwing, TYPED, now));
  assert.equal(takeLockedQrDraft(throwing, null, now), null);
});

test('the form saves as it submits, and the page hands it the refusal', () => {
  const gen = read('app/vendor-dashboard/invite/_components/locked-qr-generator.tsx');
  assert.match(gen, /<form\s+action=\{issueLockedQr\}\s+onSubmit=\{\(\) =>\s+saveLockedQrDraft\(/, 'the form writes its draft on submit');
  assert.match(gen, /takeLockedQrDraft\(store, props\.blockId \?\? null, Date\.now\(\)\)/, 'a refused arrival takes it back');
  assert.match(gen, /initial=\{kept\}/, 'through the same `initial` an edit opens with');
  const page = read('app/vendor-dashboard/invite/page.tsx');
  assert.match(page, /<LockedQrGenerator[\s\S]{0,1600}refused=\{Boolean\(search\.error\)\}/);
});
