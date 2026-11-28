'use client';

/** The Attire Maker shop lab's body (see page.lab.tsx). Fixture data only — every amount is a SAMPLE, never a price. */
import { gownShopTemplate, type GownShopOptions } from '@/lib/gown-maker';
import { GownMakerPanel } from '@/app/vendor-dashboard/shop/_components/gown-maker-panel';
import { GownFabricTypesSurface } from '@/app/admin/studio/_surfaces/gown-fabric-types-surface';
import { GownOrderPanel } from '@/app/vendor-dashboard/clients/[eventId]/_components/gown-order-panel';
import { gownDesignOf, gownDesignRows, gownQuotePrefill } from '@/lib/gown-maker';
import { GownDesignCard } from '@/app/_components/chat/cards/gown-design-card';
import { MakeQuoteCard } from '@/app/_components/chat/cards/make-quote-card';
import { ScanLab } from './scan-lab';
import { GOWN_LACES, emptyGownHand, emptyGownQuantities, startingGownBody, startingGownConfig, type GownLace } from '@/lib/gown-config';
import { gownCutContext } from '@/lib/gown-pattern/cutting-list';

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
  { id: 'satin', name: 'Satin', sheen: 0.8, sheer: 0, stiff: 0.45, verified: false, family: 'satins' as const, usedFor: ['gown_body' as const, 'skirt' as const] },
  { id: 'mikado', name: 'Mikado', sheen: 0.55, sheer: 0, stiff: 0.8, verified: false, family: 'structured' as const, usedFor: ['gown_body' as const, 'skirt' as const] },
  { id: 'tulle', name: 'Tulle', sheen: 0.1, sheer: 0.85, stiff: 0.3, verified: false, family: 'sheers' as const, usedFor: ['skirt' as const, 'sleeves_accents' as const] },
];
const STOCK = {
  shop: SHOP,
  types: TYPES,
  locked: false,
  fabrics: [
    { id: 'aaaaaaaa-0000-4000-8000-000000000001', kind: 'fabric' as const, name: 'Duchess satin', code: 'DS-01', typeId: 'satin', colours: [], pricePerMetreCentavos: 450 * P, tune: { shine: 0.1 }, thumbKey: null, tileKey: null, thumbUrl: null, tileUrl: null, active: true },
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

/** A sent design as the chat's card reads it (B8): rows on both sides; the quote pre-fill on the shop's side only. */
function cardSeed(viewer: 'vendor' | 'couple', opts: { ask?: boolean; replaced?: boolean } = {}) {
  const config = { ...startingGownConfig(), sil: 'ball' as const, neck: 'off' as const, train: 'chapel' as const, veil: 'cathedral' as const };
  const o = sample('covers');
  if (opts.ask) o.prices = {};
  const q = { ...emptyGownQuantities(), outerM: 9 };
  const addOns = ['veil', 'garter', 'fittings'] as const;
  const priced = gownDesignOf(o, config, q, [...addOns], new Map());
  const rows = gownDesignRows(config, [...addOns], null);
  return {
    ok: true as const,
    op: 'design' as const,
    viewer,
    designId: '00000000-0000-4000-8000-000000000013',
    config,
    body: null,
    measures: {},
    estimateCentavos: priced.forBride.estimateCentavos,
    forShop: viewer === 'vendor' ? priced.forShop : null,
    hand: { s: 'none' as const },
    tape: null,
    pattern: null,
    rows,
    quote: viewer === 'vendor' ? gownQuotePrefill(priced.forBride.estimateCentavos, priced.forShop, rows) : null,
    replaced: !!opts.replaced,
    sentAt: '2026-11-28T10:00:00Z',
  };
}

export default function Lab({ view }: { view: string }) {
  if (view.startsWith('card')) {
    const T = '00000000-0000-4000-8000-000000000011';
    const M = '00000000-0000-4000-8000-000000000012';
    const shopSeed = cardSeed('vendor');
    const body =
      view === 'card-quote' ? (
        <MakeQuoteCard
          threadId={T}
          eventDate="2027-06-12"
          onClose={() => undefined}
          seed={{ cards: [{ id: 'cccccccc-0000-4000-8000-000000000001', name: 'Made-to-measure gown', fromCentavos: null }] }}
          prefill={{ picked: [], offerCentavos: shopSeed.quote!.offerCentavos, note: shopSeed.quote!.note, lines: shopSeed.quote!.lines }}
        />
      ) : (
        <GownDesignCard
          threadId={T}
          messageId={M}
          stamp={view === 'card-bride' ? 'You · sent from the Attire Maker · 10:24' : 'Sent from the Attire Maker · 10:24'}
          seed={
            view === 'card-failed'
              ? 'failed'
              : view === 'card-bride'
                ? cardSeed('couple')
                : view === 'card-ask'
                  ? cardSeed('vendor', { ask: true })
                  : view === 'card-replaced'
                    ? cardSeed('vendor', { replaced: true })
                    : shopSeed
          }
        />
      );
    return (
      <main className="mx-auto max-w-xl p-4" data-gown-shop-lab={view}>
        <ul className="m-0 list-none p-0">
          <li>{body}</li>
        </ul>
      </main>
    );
  }
  if (view === 'order' || view === 'order-own' || view === 'order-net') {
    const config = { ...startingGownConfig(), sleeve: 'long' as const };
    const body = { ...startingGownBody(), given: ['height', 'bust', 'waist', 'hips'] as ('height' | 'bust' | 'waist' | 'hips')[], matters: ['arms' as const] };
    const q = { ...emptyGownQuantities(), outerM: 6.5 };
    const priced = gownDesignOf(sample('covers'), config, q, [], new Map());
    return (
      <main className="mx-auto max-w-xl p-4" data-gown-shop-lab={view}>
        <GownOrderPanel
          threadId="00000000-0000-4000-8000-000000000001"
          messageId="00000000-0000-4000-8000-000000000002"
          who="Ana Reyes"
          seed={{
            ok: true,
            op: 'design',
            viewer: 'vendor',
            designId: '00000000-0000-4000-8000-000000000003',
            config,
            body,
            measures: { frontLen: { cm: 38.1, from: 'estimate' }, shoulderApex: { cm: 22.2, from: 'estimate' }, apexApex: { cm: 14, from: 'typed' }, acrossBack: { cm: 31.3, from: 'estimate' }, acrossChest: { cm: 29.2, from: 'estimate' }, shoulderLen: { cm: 11.5, from: 'typed' }, sideLen: { cm: 18.3, from: 'estimate' }, neck: { cm: 33.6, from: 'typed' }, waistHip: { cm: 21, from: 'estimate' }, waistFloor: { cm: 98, from: 'typed' }, napeWaist: { cm: 40, from: 'estimate' }, armhole: { cm: 42, from: 'typed' }, upperArm: { cm: 29, from: 'typed' }, elbow: { cm: 25, from: 'estimate' }, wrist: { cm: 15.5, from: 'typed' }, armBent: { cm: 59, from: 'typed' } },
            estimateCentavos: priced.forBride.estimateCentavos,
            forShop: priced.forShop,
            hand:
              view === 'order-net'
                ? { s: 'none' }
                : {
                    s: 'sent',
                    hand: {
                      ...emptyGownHand(),
                      handBeads: Array.from({ length: 36 }, (_, i) => ({ ph: (i / 36) * 6, y: 1.2, kind: 'pearl' as const, col: 'ivory', mm: 4, spin: 0 })),
                      handLace: Array.from({ length: 4 }, (_, i) => ({ u: i / 4, y: 0.8, rot: 0, id: GOWN_LACES.find((l) => l.id !== 'none')!.id as Exclude<GownLace, 'none'>, cm: 6 })),
                    },
                  },
            tape: { tape: { waistHip: 21.5 }, fitAt: '2026-11-27T10:00:00Z' },
            pattern: {
              shop: { seam: 1.5, hem: 2.5, zip: 2, neck: 1 },
              paper: 'a4',
              order: view === 'order-own' ? { seamAllow: { seam: 1, hem: 4, zip: 2.5, neck: 0.8 }, netPattern: false } : { seamAllow: null, netPattern: view === 'order-net' },
              cut: gownCutContext(config, { ...q, materials: { ...q.materials, outerM: 6.5, liningM: 5.5, netM: 4 } }, 'Duchess satin'),
            },
            rows: gownDesignRows(config, [], null),
            quote: null,
            replaced: false,
            sentAt: '2026-11-26T10:00:00Z',
          }}
        />
      </main>
    );
  }
  if (view === 'scan') {
    return (
      <main className="mx-auto max-w-xl p-4" data-gown-shop-lab={view}>
        <ScanLab stock={STOCK} />
      </main>
    );
  }
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
