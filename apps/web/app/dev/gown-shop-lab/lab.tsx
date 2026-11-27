'use client';

/** The Attire Maker shop lab's body (see page.lab.tsx). Fixture data only — every amount is a SAMPLE, never a price. */
import { gownShopTemplate, type GownShopOptions } from '@/lib/gown-maker';
import { GownMakerPanel } from '@/app/vendor-dashboard/shop/_components/gown-maker-panel';
import { GownFabricTypesSurface } from '@/app/admin/studio/_surfaces/gown-fabric-types-surface';

const P = 100; // ₱1 in centavos — SAMPLE amounts only

function sample(mode: GownShopOptions['mode']): GownShopOptions {
  const o = gownShopTemplate();
  o.mode = mode;
  o.prices = { base_aline: 25000 * P, base_ball: 40000 * P, fab_satin: 350 * P, fab_mikado: 900 * P, lin_satin: 120 * P, zipper: 80 * P, rate: 150 * P };
  o.markupPct = mode === 'covers' ? 20 : 0;
  o.addOns.veil = { state: 'priced', centavos: 3500 * P };
  o.addOns.garter = { state: 'free' };
  o.addOns.garment_bag = { state: 'free' };
  o.addOns.shoes = { state: 'request' };
  o.addOns.fittings = { state: 'priced', centavos: null };
  return o;
}

const SHOP = '11111111-2222-4333-8444-555555555555';
const TYPES = [
  { id: 'satin', name: 'Satin', sheen: 0.8, sheer: 0, stiff: 0.45, verified: false },
  { id: 'mikado', name: 'Mikado', sheen: 0.55, sheer: 0, stiff: 0.8, verified: false },
  { id: 'tulle', name: 'Tulle', sheen: 0.1, sheer: 0.85, stiff: 0.3, verified: false },
];
const STOCK = {
  shop: SHOP,
  types: TYPES,
  locked: false,
  fabrics: [
    { id: 'aaaaaaaa-0000-4000-8000-000000000001', kind: 'fabric' as const, name: 'Duchess satin', code: 'DS-01', typeId: 'satin', colours: [{ name: 'Ivory', hex: '#f0e8d6' }], pricePerMetreCentavos: 450 * P, tune: { shine: 0.1 }, thumbKey: null, tileKey: null, thumbUrl: null, tileUrl: null, active: true },
    { id: 'aaaaaaaa-0000-4000-8000-000000000002', kind: 'fabric' as const, name: 'Silk mikado', code: null, typeId: 'mikado', colours: [], pricePerMetreCentavos: null, tune: {}, thumbKey: null, tileKey: null, thumbUrl: null, tileUrl: null, active: true },
    { id: 'aaaaaaaa-0000-4000-8000-000000000003', kind: 'lace' as const, name: 'Chantilly', code: 'CH-7', typeId: 'tulle', colours: [], pricePerMetreCentavos: 1200 * P, tune: {}, thumbKey: null, tileKey: null, thumbUrl: null, tileUrl: null, active: false },
  ],
  looks: [{ id: 'bbbbbbbb-0000-4000-8000-000000000001', name: 'Garden A-line', photoKey: null, photoUrl: null, config: { sil: 'aline', neck: 'v' }, active: true }],
};

const REGISTRY = [
  { id: 'satin', name: 'Satin', aliases: [], family: 'satins' as const, gsm: 100, stiff: 0.35, sheen: 0.8, sheer: 0, stretch: 'none' as const, usedFor: ['gown_body' as const], renderAs: null, active: true, sort: 1, verified: false },
  { id: 'tulle', name: 'Tulle', aliases: ['net'], family: 'sheers' as const, gsm: 18, stiff: 0.3, sheen: 0.1, sheer: 0.85, stretch: 'none' as const, usedFor: ['skirt' as const, 'sleeves_accents' as const], renderAs: null, active: true, sort: 6, verified: true },
  { id: 'jusi', name: 'Jusi', aliases: [], family: 'handwoven' as const, gsm: 30, stiff: 0.4, sheen: 0.3, sheer: 0.6, stretch: 'none' as const, usedFor: ['barong' as const], renderAs: 'tulle', active: false, sort: 11, verified: false },
];

export default function Lab({ view }: { view: string }) {
  if (view === 'types') {
    return (
      <main className="mx-auto max-w-xl p-4" data-gown-shop-lab={view}>
        <GownFabricTypesSurface seed={REGISTRY} />
      </main>
    );
  }
  if (view === 'fabrics' || view === 'looks' || view === 'stock-empty') {
    const stockSeed = view === 'stock-empty' ? { ...STOCK, fabrics: [], looks: [] } : STOCK;
    return (
      <main className="mx-auto max-w-xl p-4" data-gown-shop-lab={view}>
        <GownMakerPanel key={view} seed={{ options: sample('covers'), saved: true, locked: false }} startView={view === 'looks' ? 'looks' : 'fabrics'} stockSeed={stockSeed} />
      </main>
    );
  }
  const seed =
    view === 'fresh'
      ? { options: gownShopTemplate(), saved: false, locked: false }
      : view === 'locked'
        ? { options: sample('covers'), saved: true, locked: true }
        : { options: sample(view === 'extras' ? 'extras' : 'covers'), saved: true, locked: false };
  return (
    <main className="mx-auto max-w-xl p-4" data-gown-shop-lab={view}>
      <GownMakerPanel key={view} seed={seed} />
    </main>
  );
}
