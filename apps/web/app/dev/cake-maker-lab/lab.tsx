'use client';

/** The Cake Maker lab's body (see page.lab.tsx). Fixture data only — every amount is a SAMPLE, never a price. */
import { useMemo } from 'react';
import { cakeConfigTotalCentavos, cakeDesignOf, cakeOfferOf, cakeOptionsToDraftItems, cakeTemplate, cupcakeCountOf, readCakeCard, type CakeOptions } from '@/lib/cake-maker';
import { CAKE_ARRANGEMENTS, cakeFigureSpec, sanitizeCakeConfig, startingCakeConfig, type CakeArrangement, type CakeConfig } from '@/lib/cake-config';
import type { DraftItem } from '@/lib/package-authoring';
import type { VendorPackageItemRow, VendorPackageWithItems } from '@/lib/vendor-packages';
import { CakeOptionsStep } from '@/app/vendor-dashboard/services/_components/cake-options-step';
import { CakeDesignCard } from '@/app/_components/chat/cards/cake-design-card';
import { CakeFigure } from '@/app/_components/plan3d/kit/cake-figure';
import { CakeView } from '@/app/_components/plan3d/kit/cake-view';

const K = 100_000; // ₱1,000 in centavos — SAMPLE extras
const ONE = 12_000 * 100; // a SAMPLE one price

function sampleCake(): CakeOptions {
  const c = cakeTemplate();
  c.tiers = { maxReal: 6, standard: 3, realExtraCentavos: 3 * K, display: { max: 2, extraCentavos: K } };
  c.flavours = c.flavours!.map((f) => (f.label === 'Red velvet' ? { ...f, extraCentavos: K } : f));
  c.finish = c.finish!.map((f) => (f.look === 'fondant' ? { ...f, extraCentavos: 2 * K } : f));
  c.accents = c.accents!.map((f) => (f.look === 'none' ? f : { ...f, extraCentavos: K }));
  c.flowing = c.flowing!.map((f) => (f.look === 'none' ? f : { ...f, extraCentavos: 2 * K }));
  c.monogram = { extraCentavos: K };
  c.cupcakes = { packs: [{ count: 24, priceCentavos: 3 * K }, { count: 48, priceCentavos: 5 * K }], tower: { extraCentavos: K } };
  return c;
}

function asPackage(items: DraftItem[]): VendorPackageWithItems {
  const rows = items.map((i, idx) => ({
    item_id: i.ref,
    package_id: 'lab-pkg',
    canonical_service: i.canonical_service,
    service_description: i.service_description,
    is_default_included: i.is_default_included,
    is_required: i.is_required,
    replacement_value_centavos: i.replacement_value_centavos,
    display_order: idx,
    created_at: '2026-11-21T00:00:00Z',
    parent_option_id: null,
    pick_min: i.pickMin ?? null,
    pick_max: i.pickMax ?? null,
    max_extra_hours: null,
    extra_hour_centavos: null,
    cake_part: i.cakePart ?? null,
    options: i.options.map((o, oi) => ({
      option_id: o.ref,
      item_id: i.ref,
      option_label: o.label,
      price_delta_centavos: o.price_delta_centavos,
      is_default: o.is_default,
      is_available: o.is_available,
      display_order: oi,
      look_key: o.lookKey ?? null,
    })),
  })) as unknown as VendorPackageItemRow[];
  return { package_id: 'lab-pkg', vendor_profile_id: 'lab-shop', package_name: 'Wedding cake', total_price_centavos: ONE, is_active: true, items: rows } as unknown as VendorPackageWithItems;
}

/** A sample sent design: 4 tiers (one display), floral cascade, drip, the monogram, cupcakes on a tower. */
function sampleDesign(offerOf: ReturnType<typeof cakeOfferOf>): CakeConfig {
  const r = sanitizeCakeConfig(
    {
      ...startingCakeConfig(offerOf),
      tiers: [
        { kind: 'real', flavourRef: 'fl:3', accent: 'pearls' },
        { kind: 'real', flavourRef: 'fl:2', accent: 'drip' },
        { kind: 'real', flavourRef: 'fl:5', accent: 'none' },
        { kind: 'display', flavourRef: null, accent: 'gold_leaf' },
      ],
      cuttingTier: 0,
      finish: 'fondant',
      flowing: 'floral_cascade',
      topper: 'names',
      monogram: 'front',
      colours: [
        { hex: '#C98B8B', name: 'Dusty rose' },
        { hex: '#9CAF94', name: 'Sage' },
      ],
      message: 'Ana & Migs',
      instructions: 'Less sweet frosting, please. The cutting tier faces the guests.',
      cupcakes: { packRef: 'pack:24', flavourRef: null, match: true, placement: 'tower' },
    },
    offerOf,
  );
  if (!r.ok) throw new Error(`lab sample refused: ${r.reason}`);
  return r.config;
}

export default function CakeMakerLab({ view, fail, n }: { view: string; fail: boolean; n: number }) {
  const pkg = useMemo(() => asPackage(cakeOptionsToDraftItems(sampleCake(), 'wedding_cake')), []);
  const card = useMemo(() => readCakeCard(pkg)!, [pkg]);
  const offer = useMemo(() => cakeOfferOf(card, 40), [card]);

  if (view === 'supplier' || view === 'locked') {
    return (
      <main className="mx-auto max-w-xl p-4">
        <CakeOptionsStep seed={{ status: 'ok', cake: sampleCake(), saved: true, locked: view === 'locked' }} serviceId={null} priceWords="₱12,000" />
      </main>
    );
  }

  if (view === 'figures') {
    // Every count 1…10, and every arrangement — the ONE model, drawn in 2D.
    const tierCfg = (count: number, arrangement: CakeArrangement): CakeConfig => ({
      ...startingCakeConfig(offer),
      tiers: Array.from({ length: count }, (_, i) => ({ kind: 'real' as const, flavourRef: null, accent: i % 3 === 1 ? ('ribbon' as const) : ('none' as const) })),
      arrangement,
      topper: 'flowers',
      colours: [{ hex: '#C98B8B', name: 'Dusty rose' }],
    });
    return (
      <main className="mx-auto max-w-3xl p-4">
        <div className="grid grid-cols-5 gap-2" data-lab-counts="">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="rounded-xl bg-ink/[0.04] p-2 text-center text-[11px]">
              <CakeFigure spec={cakeFigureSpec(tierCfg(i + 1, 'stacked'))} />
              {i + 1}
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2" data-lab-arrangements="">
          {CAKE_ARRANGEMENTS.map((a) => (
            <div key={a.id} className="rounded-xl bg-ink/[0.04] p-2 text-center text-[11px]">
              <CakeFigure spec={cakeFigureSpec(tierCfg(4, a.id))} />
              {a.label}
            </div>
          ))}
        </div>
      </main>
    );
  }

  const config = sampleDesign(offer);
  const flavourLabels: Record<string, string> = { 'fl:1': 'Vanilla chiffon', 'fl:2': 'Chocolate', 'fl:3': 'Ube', 'fl:4': 'Mocha', 'fl:5': 'Red velvet' };

  if (view === 'figure') {
    return (
      <main className="mx-auto max-w-md p-4">
        <CakeView spec={cakeFigureSpec(config, (r) => flavourLabels[r] ?? null, cupcakeCountOf(config))} monogramText="A&M" title="Sample cake" />
        <p className="mt-2 text-[12px] text-ink/55">{n > 0 ? `n=${n}` : ''}</p>
      </main>
    );
  }

  const estimate = cakeConfigTotalCentavos(pkg, card, config, 0, false) ?? ONE;
  const design = cakeDesignOf(card, config, { cardName: 'Wedding cake', oneCentavos: ONE, estimateCentavos: estimate });
  const seed = fail
    ? ('failed' as const)
    : {
        ok: true as const,
        op: 'design' as const,
        design,
        config,
        flavourLabels,
        cupcakeCount: cupcakeCountOf(config),
        monogramText: 'A&M',
        inspirationUrl: null,
        cardId: 'lab-card',
        usualPrepDays: 3,
      };
  return (
    <main className="mx-auto max-w-md p-4">
      {view === 'order' ? (
        <>
          <p className="home-k2 mb-2">
            Their design <span className="font-normal text-ink/55">from the chat · 21 Nov</span>
          </p>
          <CakeDesignCard threadId="lab-thread" messageId="lab-msg" place="order" seed={seed} links={{ quoteHref: '#quote', chatHref: '#chat' }} />
        </>
      ) : (
        <>
          <p className="mb-2 w-fit rounded-2xl bg-ink/[0.06] px-3 py-2 text-sm">Hi! We designed our cake on your card 🙂</p>
          <CakeDesignCard threadId="lab-thread" messageId="lab-msg" place="chat" seed={seed} stamp="Sent from “Design your cake” · 10:24" />
        </>
      )}
    </main>
  );
}
