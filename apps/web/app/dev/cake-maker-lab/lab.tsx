'use client';

/** The Cake Maker lab's body (see page.lab.tsx). Fixture data only — every amount is the drawing's SAMPLE. */
import { useMemo } from 'react';
import {
  cakeDesignOf,
  cakeOptionsToDraftItems,
  cakeTemplate,
  readCakeCard,
  startingCakeDesign,
  type CakeExtras,
  type CakeOptions,
  type MoodCakeColour,
} from '@/lib/cake-maker';
import type { DraftItem } from '@/lib/package-authoring';
import type { VendorPackageItemRow, VendorPackageWithItems } from '@/lib/vendor-packages';
import CakeDesigner from '@/app/_components/vendor-packages/cake-designer';
import { CakeOptionsStep } from '@/app/vendor-dashboard/services/_components/cake-options-step';
import { CakeDesignCard } from '@/app/_components/chat/cards/cake-design-card';

const K = 100_000; // ₱1,000 in centavos — SAMPLE extras, as drawn
const ONE = 12_000 * 100; // the drawing's sample one price

function sampleCake(): CakeOptions {
  const c = cakeTemplate();
  c.tiers.extraCentavos = { '4': 3 * K, '5': 6 * K };
  c.flavours = c.flavours!.map((f) => (f.label === 'Red velvet' ? { ...f, extraCentavos: K } : f));
  c.finish = c.finish!.map((f) => (f.label === 'Fondant' ? { ...f, extraCentavos: 2 * K } : f));
  c.design = c.design!.map((f) =>
    f.label === 'Floral cascade' ? { ...f, extraCentavos: 2 * K } : f.label === 'Drip' || f.label === 'Pearls' ? { ...f, extraCentavos: K } : f,
  );
  c.topper = c.topper!.map((f) =>
    f.label === 'Figurine' ? { ...f, extraCentavos: 2 * K } : f.label === 'None' ? f : { ...f, extraCentavos: K },
  );
  return c;
}

function asPackage(items: DraftItem[]): VendorPackageWithItems {
  const rows: VendorPackageItemRow[] = items.map((i, idx) => ({
    item_id: i.ref,
    package_id: 'lab-pkg',
    canonical_service: i.canonical_service,
    service_description: i.service_description,
    is_default_included: i.is_default_included,
    is_required: i.is_required,
    replacement_value_centavos: i.replacement_value_centavos,
    display_order: idx,
    created_at: '2026-11-21T00:00:00Z',
    parent_option_id: i.parentRef?.optionRef ?? null,
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
      photo_ref: o.photoRef ?? null,
    })),
  })) as unknown as VendorPackageItemRow[];
  return {
    package_id: 'lab-pkg',
    vendor_profile_id: 'lab-shop',
    package_name: 'Wedding cake',
    description: null,
    total_price_centavos: ONE,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    unspent_credit_policy: 'forfeit',
    primary_canonical_service: 'wedding_cake',
    is_active: true,
    created_at: '2026-11-21T00:00:00Z',
    updated_at: '2026-11-21T00:00:00Z',
    items: rows,
  } as unknown as VendorPackageWithItems;
}

const MOOD: MoodCakeColour[] = [
  { hex: '#C98B8B', name: 'Dusty rose', slot: 'Cake', setByYou: true },
  { hex: '#9CAF94', name: 'Sage', slot: 'Dominant', setByYou: false },
  { hex: '#E3CFA6', name: 'Champagne', slot: 'Supporting', setByYou: false },
  { hex: '#C46A4A', name: 'Terracotta', slot: 'Accent', setByYou: false },
  { hex: '#F1E9DC', name: 'Ivory', slot: 'Neutral', setByYou: false },
  { hex: '#2F3E5C', name: 'Navy', slot: 'Accent 2', setByYou: false },
];

const ASK = { vendorProfileId: 'lab-shop', vendorLabel: 'Dulce Cakes', vendorServiceId: 'lab-card', categoryKey: 'wedding_cake' };

export default function CakeMakerLab({ view, mood, fail }: { view: string; mood: string | null; fail: boolean }) {
  const pkg = useMemo(() => asPackage(cakeOptionsToDraftItems(sampleCake(), 'wedding_cake')), []);
  const card = useMemo(() => readCakeCard(pkg)!, [pkg]);

  if (view === 'supplier') {
    return (
      <main className="mx-auto max-w-xl p-4">
        <CakeOptionsStep seed={{ status: 'ok', cake: sampleCake(), saved: true }} serviceId={null} priceWords="₱12,000" />
      </main>
    );
  }

  if (view === 'received' || view === 'order') {
    const s = startingCakeDesign(card);
    const pick = (line: VendorPackageItemRow | null, label: string) => line?.options?.find((o) => o.option_label === label)?.option_id ?? null;
    const size = card.sizes.find((z) => z.tiers === 3)!;
    const flavours = { ...s.flavours };
    const ids = size.flavourLines.map((l) => l.item_id);
    flavours[ids[0]!] = pick(size.flavourLines[0]!, 'Ube')!;
    flavours[ids[1]!] = pick(size.flavourLines[1]!, 'Chocolate')!;
    const design = cakeDesignOf(
      pkg,
      card,
      {
        ...s,
        flavours,
        designOptionId: pick(card.design, 'Floral cascade'),
        topperOptionId: pick(card.topper, 'Acrylic names'),
        colours: [
          { kind: 'mood', name: 'Dusty rose', hex: '#C98B8B' },
          { kind: 'mood', name: 'Sage', hex: '#9CAF94' },
        ],
        message: 'Ana & Migs · 12.19',
      },
      { cardName: 'Wedding cake', messageMax: 40, paxCount: 0 },
    )!;
    const seed = fail ? ('failed' as const) : { ok: true as const, op: 'design' as const, design, cardId: 'lab-card', usualPrepDays: 3 };
    return (
      <main className="mx-auto max-w-md p-4">
        {view === 'received' ? (
          <>
            <p className="mb-2 w-fit rounded-2xl bg-ink/[0.06] px-3 py-2 text-sm">Hi! We designed our cake on your card 🙂</p>
            <CakeDesignCard threadId="lab-thread" messageId="lab-msg" place="chat" seed={seed} stamp="Sent from “Design your cake” · 10:24" />
          </>
        ) : (
          <>
            <p className="home-k2 mb-2">
              Their design <span className="font-normal text-ink/55">from the chat · 21 Nov</span>
            </p>
            <CakeDesignCard
              threadId="lab-thread"
              messageId="lab-msg"
              place="order"
              seed={seed}
              links={{ quoteHref: '#quote', chatHref: '#chat' }}
            />
            <p className="home-k2 mb-2 mt-4">Making time</p>
            <p className="text-[14px] text-ink">
              14 days for this order<span className="text-ink/55"> · you set it on the quote · from 5 Dec</span>
            </p>
          </>
        )}
      </main>
    );
  }

  const extras: CakeExtras = {
    cardId: 'lab-card',
    cardName: 'Wedding cake',
    messageMax: 40,
    prepDays: 3,
    photoUrls: {},
    mood: mood === 'unread' ? null : mood === 'none' ? [] : MOOD,
  };
  return <CakeDesigner eventId="lab-event" pkg={pkg} card={card} cake={extras} ask={ASK} paxCount={0} onClose={() => undefined} />;
}
