/**
 * /dev/supplier-set-two-lab — the eight supplier pages of "set two" on the November look (owner-approved 21 Nov 2026,
 * drawing `prototypes/supplier_pages_set2_2026-11-21/supplier_pages_set2_v2_fable.html`), each state the drawing draws,
 * inside the REAL supplier shell (`SupplierLabShell`) with the blue look on. No sign-in, no database: the page BODIES are
 * the shipped components, handed fixtures in place of the reads. DEV-ONLY: production builds 404 this route first thing.
 *
 *   (no params)   the list of states
 *   ?s=<state>    one state — e.g. `contract-draft`, `contract-failed`, `upload`, `upload-failed`
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { VendorContractRow } from '@/lib/contracts';
import '@/app/vendor-dashboard/_components/supplier-look.css';
import { SupplierLabShell } from '../_components/supplier-lab-shell';
import { ContractBody, ContractReadFailed } from '@/app/vendor-dashboard/contracts/[contractId]/contract-body';
import { UploadContractBody } from '@/app/vendor-dashboard/contracts/new/upload-body';
import { CocktailBody, CocktailReadFailed } from '@/app/vendor-dashboard/clients/[eventId]/cocktail/cocktail-body';
import type { CocktailEditorData } from '@/app/vendor-dashboard/clients/[eventId]/cocktail/cocktail-editor';
import { EditorialMediaBody } from '@/app/vendor-dashboard/clients/[eventId]/editorial-media/editorial-media-body';
import { ChallengePhotosBody } from '@/app/vendor-dashboard/clients/[eventId]/challenge-photos/challenge-photos-body';
import { SeatPlanBody, SeatPlanReadFailed, type Plan } from '@/app/vendor-dashboard/clients/[eventId]/seat-plan/seat-plan-body';
import { ProductionSheetBody, ProductionSheetReadFailed } from '@/app/vendor-dashboard/clients/[eventId]/production-sheet/production-sheet-body';
import type { Metrics, PortionRule } from '@/app/vendor-dashboard/clients/[eventId]/production-sheet/production-sheet-model';

const CONTRACT: VendorContractRow = {
  contract_id: '00000000-0000-4000-8000-00000000c001',
  public_id: 'S89K-LAB0000001',
  vendor_profile_id: '00000000-0000-4000-8000-00000000v001',
  event_id: '00000000-0000-4000-8000-00000000e001',
  event_vendor_id: null,
  order_id: null,
  uploaded_by_user_id: '00000000-0000-4000-8000-00000000u001',
  title: 'Catering package — Dec 12',
  description: 'Plated dinner for 150, two buffet stations. Final count by Dec 1.',
  file_url: '#lab-file',
  file_name: 'catering-claire-indalecio.pdf',
  file_size_bytes: 1_258_291,
  mime_type: 'application/pdf',
  status: 'draft',
  sent_for_signature_at: null,
  fully_signed_at: null,
  cancelled_at: null,
  cancelled_by_user_id: null,
  cancelled_reason: null,
  created_at: '2026-11-20T07:40:00Z',
  updated_at: '2026-11-20T07:40:00Z',
};
const EVENT = { display_name: 'Claire & Indalecio', event_date: '2026-12-12' };
const EVENTS = [
  { id: '00000000-0000-4000-8000-00000000e001', title: 'Claire & Indalecio' },
  { id: '00000000-0000-4000-8000-00000000e002', title: 'Reyes & Santos' },
];


/* ── part 2 · inside a client ─────────────────────────────────────────────────────────────────── */
const EV = '00000000-0000-4000-8000-00000000e001';
const NAME = 'Claire & Indalecio';
const tables = (n: number, x0: number, y0: number) =>
  Array.from({ length: n }, (_, i) => ({
    table_id: `t${x0}-${i}`,
    label: `T${i + 1 + (x0 > 70 ? 4 : 0)}`,
    table_type: 'round_10',
    x: x0 + (i % 2) * 14,
    y: y0 + Math.floor(i / 2) * 18,
    rotation_deg: 0,
    seated: 8 + (i % 3),
  }));
const COCKTAIL: CocktailEditorData = {
  can_arrange: true,
  can_booth: true,
  venue: { width_m: 32, length_m: 24 },
  cocktail: { label: 'Cocktail Area', linked: false, x: 31, y: 35, w: 52, h: 56 },
  entrance: null,
  stage: { x: 81, y: 12, w: 30, h: 12 },
  dance: null,
  tables: [...tables(6, 68, 32), ...tables(2, 30, 80).map((t, i) => ({ ...t, x: 30 + i * 16, y: 80, label: `T${7 + i}` }))],
  booths: [
    { booth_id: 'b1', booth_type: 'dessert_station', label: 'Dessert Station', offerings: null, x: 22, y: 30, is_mine: true, vendor_name: null },
    { booth_id: 'b2', booth_type: 'photo_booth', label: 'Photo Booth', offerings: null, x: 40, y: 47, is_mine: false, vendor_name: 'Lumina' },
    { booth_id: 'b3', booth_type: 'mobile_bar', label: 'Mobile Bar', offerings: null, x: 18, y: 52, is_mine: false, vendor_name: 'Bar Co' },
  ],
  signs: [{ sign_id: 's1', label: 'Restrooms', x: 47, y: 20, rotation_deg: 0 }],
} as unknown as CocktailEditorData;
/** Two flat sample photos (4×5 PNGs) — a warm one and a cool one, standing in for real shots. */
const P1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAFCAIAAADtz9qMAAAAFElEQVR4nGPcMK+NAQaYGJAAkRwAdNwB3i2pS2oAAAAASUVORK5CYII=';
const P2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAFCAIAAADtz9qMAAAAFElEQVR4nGNsmLSGAQaYGJAAkRwAbxwByKHL0xAAAAAASUVORK5CYII=';
const SEAT: Plan = {
  published_at: '2026-11-18T00:00:00Z',
  venue: { width_m: 32, length_m: 24 },
  stage: { x: 50, y: 8, w: 30, h: 10 },
  dance: { x: 50, y: 30, w: 26, h: 16 },
  entrance: { x: 50, y: 97 },
  service_entrance: { x: 96, y: 60 },
  cocktail: { label: 'Cocktail Area', x: 16, y: 72, w: 26, h: 34, venue: { width_m: null, length_m: null }, window: { label: 'Cocktails', start_at: '2026-12-12T18:00:00', end_at: '2026-12-12T19:00:00' } },
  dietary_included: true,
  tables: Array.from({ length: 8 }, (_, i) => ({
    table_id: `st${i}`, label: `Table ${i + 1}`, table_type: i % 3 === 0 ? 'rect_8' : 'round_10', capacity: 10,
    x: i < 7 ? 38 + (i % 4) * 15 : null, y: i < 7 ? 52 + Math.floor(i / 4) * 20 : null, rotation_deg: 0, sort_order: i,
    seated: 8 + (i % 3), meal_counts: { chicken: 4, beef: 3, fish: 1 + (i % 2) },
  })),
  objects: [
    { object_id: 'o1', zone: 'cocktail', object_type: 'dessert_station', label: 'Dessert Station', x: 12, y: 70, is_mine: true, vendor_name: null },
    { object_id: 'o2', zone: 'reception', object_type: 'photo_booth', label: 'Photo Booth', x: 88, y: 30, is_mine: false, vendor_name: 'Lumina' },
  ],
};
const METRICS: Metrics = {
  as_of: '2026-11-20T13:14:00Z',
  event_date: '2026-12-12',
  finality: { is_provisional: true, responded_pct: 88, pending: 12, maybe: 8 },
  headcount_scenarios: { confirmed: 142, expected: 150, ceiling: 162 },
  invited: 186,
  declined: 24,
  meal_counts: { chicken: 61, beef: 42, fish: 23, vegetarian: 9, kids: 5, unspecified: 2 },
  per_block_headcount: {
    ceremony: { confirmed: 120, expected: 128, ceiling: 140 },
    cocktails: { confirmed: 138, expected: 146, ceiling: 158 },
    reception: { confirmed: 142, expected: 150, ceiling: 162 },
  },
  dietary_restriction_count: 6,
};
const RULES: PortionRule[] = [
  { rule_id: 'r1', label: 'Rice', unit: 'kg', qty_per_guest: 0.35, applies_to_meals: null, applies_to_block: null, headcount_basis: 'expected', waste_factor_pct: 10 },
  { rule_id: 'r2', label: 'Lechon', unit: 'kg', qty_per_guest: 0.25, applies_to_meals: null, applies_to_block: 'reception', headcount_basis: 'confirmed', waste_factor_pct: 5 },
  { rule_id: 'r3', label: 'Fish fillet', unit: 'kg', qty_per_guest: 0.2, applies_to_meals: ['fish'], applies_to_block: null, headcount_basis: 'confirmed', waste_factor_pct: 0 },
  { rule_id: 'r4', label: 'Canapés', unit: 'pcs', qty_per_guest: 6, applies_to_meals: null, applies_to_block: 'cocktails', headcount_basis: 'expected', waste_factor_pct: 10 },
];
const CREW = [
  { name: 'Lumina Studio', category: 'photo', meals: 4, fromListing: false },
  { name: 'Kuwerdas Band', category: 'band', meals: 6, fromListing: true },
  { name: 'Bloom & Twig', category: 'florist', meals: 3, fromListing: false },
  { name: 'Ilaw Lights', category: 'lights', meals: 5, fromListing: false },
];

const STATES: Record<string, { label: string; draw: () => ReactNode }> = {
  upload: { label: 'Contracts › upload a contract', draw: () => <UploadContractBody eventOptions={EVENTS} defaultEventId="" /> },
  'upload-none': { label: 'Upload · no couple to pick yet', draw: () => <UploadContractBody eventOptions={[]} defaultEventId="" /> },
  'upload-failed': {
    label: 'Upload · your conversations could not be read (honest state · new)',
    draw: () => <UploadContractBody eventOptions={null} defaultEventId="" />,
  },
  'contract-draft': { label: 'Contract · draft', draw: () => <ContractBody contract={CONTRACT} event={EVENT} eventFailed={false} /> },
  'contract-visible': {
    label: 'Contract · visible to the couple',
    draw: () => <ContractBody contract={{ ...CONTRACT, status: 'sent_for_signature' }} event={EVENT} eventFailed={false} />,
  },
  'contract-cancelled': {
    label: 'Contract · cancelled',
    draw: () => (
      <ContractBody
        contract={{ ...CONTRACT, status: 'cancelled', cancelled_at: '2026-11-20T07:40:00Z', cancelled_reason: 'Couple changed terms' }}
        event={EVENT}
        eventFailed={false}
      />
    ),
  },
  cocktail: { label: 'Cocktail area · arranging the room', draw: () => <CocktailBody eventId={EV} eventName={NAME} plan={COCKTAIL} /> },
  'cocktail-booth': {
    label: 'Cocktail area · your booth only',
    draw: () => <CocktailBody eventId={EV} eventName={NAME} plan={{ ...COCKTAIL, can_arrange: false } as CocktailEditorData} />,
  },
  'cocktail-failed': { label: 'Cocktail area · could not be read (honest state · new)', draw: () => <CocktailReadFailed eventId={EV} eventName={NAME} /> },
  story: {
    label: 'From your camera · two on, nothing staged',
    draw: () => (
      <EditorialMediaBody
        eventId={EV}
        eventName={NAME}
        vendorProfileId="lab"
        view={{
          kind: 'open',
          existingUnread: false,
          existing: [
            { mediaId: 'm1', type: 'photo', stillUrl: P1, boomerangUrl: null, caption: 'Dessert table, before the doors', moderationState: 'clean', hiddenByCouple: false },
            { mediaId: 'm2', type: 'photo', stillUrl: P2, boomerangUrl: null, caption: null, moderationState: 'unscreened', hiddenByCouple: false },
          ],
        }}
      />
    ),
  },
  'story-almost': { label: 'From your camera · almost there', draw: () => <EditorialMediaBody eventId={EV} eventName={NAME} vendorProfileId="lab" view={{ kind: 'almost', disputed: false }} /> },
  'story-not': { label: 'From your camera · not the recommended pick', draw: () => <EditorialMediaBody eventId={EV} eventName={NAME} vendorProfileId="lab" view={{ kind: 'not-recommended' }} /> },
  'production-sheet': {
    label: 'Production sheet',
    draw: () => (
      <ProductionSheetBody eventId={EV} eventName={NAME} metrics={METRICS} rules={RULES} rulesMeasured crewMeals={CREW} crewTotal={18} ruleFlag={undefined} />
    ),
  },
  'production-sheet-rules-unread': {
    label: 'Production sheet · rules could not be read',
    draw: () => (
      <ProductionSheetBody eventId={EV} eventName={NAME} metrics={METRICS} rules={[]} rulesMeasured={false} crewMeals={null} crewTotal={0} ruleFlag={undefined} />
    ),
  },
  'production-sheet-failed': {
    label: 'Production sheet · live counts could not be read (honest state · new)',
    draw: () => <ProductionSheetReadFailed eventId={EV} eventName={NAME} />,
  },
  'challenge-photos': {
    label: 'Challenge photos · two challenges',
    draw: () => (
      <ChallengePhotosBody
        eventId={EV}
        eventName={NAME}
        sections={[
          { prompt: 'Snap the dessert table', tiles: Array.from({ length: 6 }, (_, i) => ({ captureId: `c${i}`, isClip: i === 1 || i === 5, tileUrl: i % 2 ? P2 : P1, openUrl: '#' })) },
          { prompt: 'Toast with the couple', tiles: Array.from({ length: 3 }, (_, i) => ({ captureId: `d${i}`, isClip: false, tileUrl: i % 2 ? P1 : P2, openUrl: '#' })) },
        ]}
      />
    ),
  },
  'challenge-photos-unread': { label: 'Challenge photos · could not be read', draw: () => <ChallengePhotosBody eventId={EV} eventName={NAME} sections={null} /> },
  'seat-plan': { label: 'Seats · view only (frame d)', draw: () => <SeatPlanBody eventId={EV} eventName={NAME} plan={SEAT} /> },
  'seat-plan-failed': { label: 'Seats · the floor plan could not be read (honest state · new)', draw: () => <SeatPlanReadFailed eventId={EV} eventName={NAME} /> },
  'contract-failed': {
    label: 'Contract · the contract could not be read (honest state · new)',
    draw: () => <ContractReadFailed contractId={CONTRACT.contract_id} />,
  },
};

export default async function SupplierSetTwoLabPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { s } = await searchParams;
  const state = s ? STATES[s] : undefined;
  if (!state) {
    return (
      <main className="min-h-dvh px-4 py-8" data-supplier-set-two-lab="list">
        <h1 className="text-xl font-semibold text-ink">Supplier pages, set two</h1>
        <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
          {Object.entries(STATES).map(([key, st]) => (
            <li key={key}>
              <Link href={`/dev/supplier-set-two-lab?s=${key}`} className="flex min-h-11 items-center py-3 text-[15px] text-ink">
                {st.label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  return (
    <div data-supplier-look="" data-supplier-set-two-lab={s}>
      <SupplierLabShell measure="own" page={s!.startsWith('contract') || s!.startsWith('upload') ? '/vendor-dashboard/contracts' : '/vendor-dashboard/customers'}>
        {state.draw()}
      </SupplierLabShell>
    </div>
  );
}
