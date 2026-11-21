'use client';

/** The Cake Maker lab's body (see page.lab.tsx). Fixture data only — every amount is a SAMPLE, never a price. */
import { LAB_HEX } from './lab-colours';
import { useMemo, useState } from 'react';
import { cakeDesignOf, cakeOfferOf, cakeShopTemplate, cupcakeCountOf, flavourLabelOf, type CakeShopOptions } from '@/lib/cake-maker';
import { CAKE_ARRANGEMENTS, CAKE_SHAPES, cakeFigureSpec, resizeCakeTiers, sanitizeCakeConfig, startingCakeConfig, type CakeArrangement, type CakeConfig, type CakeShape } from '@/lib/cake-config';
import type { CakeDesignRead, CakeOpenRead } from '@/app/_components/cake-maker/cake-actions';
import { CakeMakerPanel } from '@/app/vendor-dashboard/shop/_components/cake-maker-panel';
import { CakeDesigner } from '@/app/_components/cake-maker/cake-designer';
import { CakeDesignCard } from '@/app/_components/chat/cards/cake-design-card';
import { CakeInviteCard } from '@/app/_components/chat/cards/cake-invite-card';
import { CakeFigure } from '@/app/_components/plan3d/kit/cake-figure';
import { CakeView } from '@/app/_components/plan3d/kit/cake-view';

const K = 100_000; // ₱1,000 in centavos — SAMPLE extras
const ONE = 18_000 * 100; // a SAMPLE one price

/** The drawing's sample shop (v6 §01) — every extra a SAMPLE. */
function sampleShop(): CakeShopOptions {
  const o = cakeShopTemplate();
  const serves = [20, 50, 90, 140, 200, 260, 330, 400, 480, 560];
  const extra = [0, 0, 0, 3, 6, 8, 10, 12, 14, 16];
  o.sizes = serves.map((s, i) => ({ count: i + 1, extraCentavos: extra[i]! * K, serves: s }));
  o.display = { extraCentavos: K };
  o.flavours = o.flavours.map((f) => (f.label === 'Red velvet' ? { ...f, extraCentavos: K } : f));
  o.shapes = [
    { id: 'round', extraCentavos: 0 },
    { id: 'square', extraCentavos: K },
    { id: 'hexagon', extraCentavos: K },
    { id: 'heart', extraCentavos: 2 * K },
  ];
  o.tall = { extraCentavos: 2 * K };
  o.finishes = [
    { id: 'buttercream', extraCentavos: 0 },
    { id: 'fondant', extraCentavos: 2 * K },
    { id: 'semi_naked', extraCentavos: 0 },
  ];
  o.colours = [
    { name: 'White', hex: LAB_HEX.hFAF7F2 },
    { name: 'Blush', hex: LAB_HEX.hF2C4C4 },
    { name: 'Burgundy', hex: LAB_HEX.h7A1F2B },
    { name: 'Lilac', hex: LAB_HEX.hC8B6E2 },
  ];
  o.accents = [
    { id: 'none', extraCentavos: 0 },
    { id: 'ribbon', extraCentavos: 0 },
    { id: 'flowers', extraCentavos: K },
    { id: 'drip', extraCentavos: K },
    { id: 'pearls', extraCentavos: K },
    { id: 'gold_leaf', extraCentavos: K },
    { id: 'ruffles', extraCentavos: K },
  ];
  o.standardAccent = 'ribbon';
  o.arrangements = [
    { id: 'stacked', extraCentavos: 0 },
    { id: 'floating', extraCentavos: 2 * K },
    { id: 'pillars', extraCentavos: K },
    { id: 'offset', extraCentavos: K },
    { id: 'staircase', extraCentavos: 3 * K },
  ];
  o.flowing = [
    { id: 'floral_cascade', extraCentavos: 2 * K },
    { id: 'ribbon_cascade', extraCentavos: K },
    { id: 'pearl_strand', extraCentavos: K },
  ];
  o.monogram = { extraCentavos: K };
  o.toppers = [
    { id: 'flowers', extraCentavos: K },
    { id: 'figurine', extraCentavos: 2 * K },
    { id: 'names', extraCentavos: K },
  ];
  o.cupcakes = { packs: [{ count: 12, priceCentavos: 2 * K }, { count: 24, priceCentavos: 4 * K }, { count: 50, priceCentavos: 7 * K }], tower: true };
  return o;
}

/** A sample sent design: 4 tiers (one display), square + tall bottom, floating, cascade, the monogram, cupcakes. */
function sampleDesign(o: CakeShopOptions): CakeConfig {
  const offer = cakeOfferOf(o);
  const r = sanitizeCakeConfig(
    {
      ...startingCakeConfig(offer),
      tiers: [
        { kind: 'display', flavourRef: null, accent: 'pearls', shape: 'round', tall: false },
        { kind: 'real', flavourRef: 'f2', accent: 'flowers', shape: 'round', tall: false },
        { kind: 'real', flavourRef: 'f3', accent: 'ribbon', shape: 'round', tall: false },
        { kind: 'real', flavourRef: 'f5', accent: 'ribbon', shape: 'square', tall: true },
      ],
      cuttingTier: 3,
      arrangement: 'floating',
      finish: 'buttercream',
      flowing: 'floral_cascade',
      flowingFrom: 0,
      flowingTo: 3,
      monogram: 'topper',
      monogramTier: 3,
      colours: [
        { hex: LAB_HEX.hC98B8B, name: 'Dusty rose' },
        { hex: LAB_HEX.h9CAF94, name: 'Sage' },
      ],
      message: 'Ana & Migs',
      instructions: 'Less sweet frosting, please. The cutting tier faces the guests.',
      cupcakes: { packRef: 'pack:24', flavourRef: null, match: true, placement: 'base' },
    },
    offer,
  );
  if (!r.ok) throw new Error(`lab sample refused: ${r.reason}`);
  return r.config;
}

const PHOTO = (seed: string, hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='hsl(${hue},40%,88%)'/><rect x='30' y='62' width='40' height='22' rx='3' fill='hsl(${hue},35%,72%)'/><rect x='36' y='44' width='28' height='18' rx='3' fill='hsl(${hue},35%,78%)'/><rect x='41' y='30' width='18' height='14' rx='3' fill='hsl(${hue},35%,84%)'/><text x='50' y='96' font-size='7' text-anchor='middle' fill='#555'>${seed}</text></svg>`)}`;

function sampleOpen(o: CakeShopOptions): CakeOpenRead {
  return {
    ok: true,
    op: 'open',
    shopName: 'Dulce Cakes',
    options: o,
    cards: [{ id: 'lab-card', name: 'Wedding cake', oneCentavos: ONE, usualPrepDays: 5 }],
    mood: [
      { hex: LAB_HEX.hC98B8B, name: 'Dusty rose', slot: 'Cake', setByYou: true },
      { hex: LAB_HEX.h9CAF94, name: 'Sage', slot: 'Dominant', setByYou: false },
      { hex: LAB_HEX.hE8D9B5, name: 'Champagne', slot: 'Supporting', setByYou: false },
      { hex: LAB_HEX.hC46A4A, name: 'Terracotta', slot: 'Accent', setByYou: false },
      { hex: LAB_HEX.hF5EFE4, name: 'Ivory', slot: 'Neutral', setByYou: false },
    ],
    monogramText: 'A&M',
    guests: 180,
    photos: [
      { assetId: 'p1', url: PHOTO('Sage garden', 110), label: 'Sage garden', from: 'shop' },
      { assetId: 'p2', url: PHOTO('Blush ruffles', 350), label: 'Blush ruffles', from: 'shop' },
      { assetId: 'p3', url: PHOTO('Ivory and gold', 45), label: 'Ivory and gold', from: 'shop' },
      { assetId: 'p4', url: PHOTO('Semi-naked drip', 25), label: 'Semi-naked drip', from: 'yours' },
      { assetId: 'p5', url: PHOTO('Lilac floating', 270), label: 'Lilac floating', from: 'yours' },
    ],
  };
}

export default function CakeMakerLab({ view, fail, n }: { view: string; fail: boolean; n: number }) {
  const shop = useMemo(() => sampleShop(), []);
  const offer = useMemo(() => cakeOfferOf(shop), [shop]);
  const [open, setOpen] = useState(true);

  if (view === 'supplier' || view === 'locked' || view === 'fresh') {
    return (
      <main className="mx-auto max-w-xl p-4" data-lab-view={view}>
        <CakeMakerPanel seed={{ options: view === 'fresh' ? cakeShopTemplate() : shop, saved: view !== 'fresh', locked: view === 'locked' }} />
      </main>
    );
  }

  if (view === 'figures') {
    const cfg = (count: number, arrangement: CakeArrangement, shape: CakeShape = 'round', tall = false): CakeConfig => {
      const c = resizeCakeTiers({ ...startingCakeConfig(offer, 3), arrangement, topper: 'flowers', colours: [{ hex: LAB_HEX.hC98B8B, name: 'Dusty rose' }] }, count);
      return { ...c, tiers: c.tiers.map((t, i) => ({ ...t, shape, tall: tall && i === c.tiers.length - 1, accent: i % 3 === 1 ? 'ribbon' : 'none' })) };
    };
    const cell = 'rounded-xl bg-ink/[0.04] p-2 text-center text-[11px]';
    return (
      <main className="mx-auto max-w-3xl p-4">
        <div className="grid grid-cols-5 gap-2" data-lab-counts="">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={cell}>
              <CakeFigure spec={cakeFigureSpec(cfg(i + 1, 'stacked'))} />
              {i + 1}
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2" data-lab-arrangements="">
          {CAKE_ARRANGEMENTS.map((a) => (
            <div key={a.id} className={cell}>
              <CakeFigure spec={cakeFigureSpec(cfg(4, a.id))} />
              {a.label}
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2" data-lab-shapes="">
          {CAKE_SHAPES.map((s) => (
            <div key={s.id} className={cell}>
              <CakeFigure spec={cakeFigureSpec(cfg(3, 'stacked', s.id, true))} />
              {s.label} · tall bottom
            </div>
          ))}
        </div>
      </main>
    );
  }

  const config = sampleDesign(shop);
  const spec = cakeFigureSpec(config, (r) => flavourLabelOf(shop, r), cupcakeCountOf(config));

  if (view === 'figure') {
    return (
      <main className="mx-auto max-w-md p-4">
        <CakeView spec={spec} monogramText="A&M" title="Sample cake" />
        <p className="mt-2 text-[12px] text-ink/55">{n > 0 ? `n=${n}` : ''}</p>
      </main>
    );
  }

  if (view === 'demo') {
    // 🔒 A shop below Pro after the start date: the locked tile opens THIS — the designer on sample options, no Send.
    return (
      <main className="min-h-dvh p-4" data-lab-view={view}>
        {open ? (
          <CakeDesigner threadId="" demo onClose={() => setOpen(false)} />
        ) : (
          <button type="button" className="underline" onClick={() => setOpen(true)}>
            Open the demo again
          </button>
        )}
      </main>
    );
  }

  if (view === 'designer' || view === 'start') {
    return (
      <main className="min-h-dvh p-4" data-lab-view={view}>
        {open ? (
          <CakeDesigner
            threadId="lab-thread"
            seed={fail ? 'failed' : sampleOpen(shop)}
            start={view === 'designer' ? { config, cardId: 'lab-card' } : null}
            onClose={() => setOpen(false)}
          />
        ) : (
          <button type="button" className="underline" onClick={() => setOpen(true)}>
            Open the designer again
          </button>
        )}
      </main>
    );
  }

  if (view === 'invite' || view === 'invite-shop') {
    return (
      <main className="mx-auto max-w-md p-4">
        <CakeInviteCard threadId="lab-thread" viewer={view === 'invite' ? 'couple' : 'vendor'} shopName="Dulce Cakes" stamp={view === 'invite' ? 'Dulce Cakes · 10:12' : 'You · 10:12'} />
      </main>
    );
  }

  const design = cakeDesignOf(shop, config, { name: 'Wedding cake', oneCentavos: ONE });
  const couple = view === 'couple' || view === 'replaced';
  const seed: CakeDesignRead | 'failed' = fail
    ? 'failed'
    : {
        ok: true,
        op: 'design',
        viewer: couple ? 'couple' : 'vendor',
        design,
        config,
        cupcakeCount: cupcakeCountOf(config),
        monogramText: 'A&M',
        inspirationUrl: PHOTO('Sage garden', 110),
        cardId: 'lab-card',
        usualPrepDays: 5,
        replaced: view === 'replaced',
        sentAt: '2026-11-21T02:24:00Z',
      };
  return (
    <main className="mx-auto max-w-md p-4" data-lab-view={view}>
      {view === 'order' ? (
        <>
          <p className="home-k2 mb-2">
            Their design <span className="font-normal text-ink/55">from the chat · 21 Nov</span>
          </p>
          <CakeDesignCard threadId="lab-thread" messageId="lab-msg" place="order" seed={seed} links={{ quoteHref: '#quote', chatHref: '#chat' }} />
        </>
      ) : (
        <CakeDesignCard
          threadId="lab-thread"
          messageId="lab-msg"
          place="chat"
          seed={seed}
          stamp={couple ? 'You · sent from the Cake Maker · 10:24' : 'Sent from the Cake Maker · 10:24'}
        />
      )}
    </main>
  );
}
