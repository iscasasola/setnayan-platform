/**
 * /dev/bundle-maker-lab — THE BUNDLE MAKER (`packages/_components/package-editor.tsx`) on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`), the production check first.
 *
 * It draws the REAL `PackageEditor` — risen full screen, as the real page draws it — for the Now-beside-Proposed walk
 * against the approved prototype (specs `prototypes/shop_discounts_bundle_card_open_2026-11-09/bundle-maker.html` v3).
 * Nothing here posts anywhere useful: with no session the shipped save refuses.
 *
 *   ?s=filled   two cards (one with a discount on), one extra line, ₱9,000 extra off (default — the prototype's frame)
 *   ?s=new      a new, empty bundle — "Pick the cards this bundle sells", the totals at ₱0
 *   ?s=nocards  the card read was refused — the maker says so instead of offering nothing
 *   ?s=frozen   a booked bundle — its contents and price fixed
 *   ?s=locked   a shop that may not make bundles — the shared lock explainer
 *
 * 🧪 The figures are the APPROVED PROTOTYPE'S OWN SAMPLES (Mobile Bar ₱110,000 with a 10% offer · Mocktail station
 * ₱45,000 · ₱9,000 extra), so the built frame can be laid beside the drawn one — fixture data in a dev lab, never a
 * price a couple is charged. Names are the prototype's samples: nobody real.
 */
import { LAB_FAIR_WORDS } from '../lab-fair-words';
import { notFound } from 'next/navigation';
import { papersProgress } from '@/lib/locks';
import { PACKAGE_CANONICAL_TO_VENDOR_CATEGORY } from '@/lib/vendor-packages';
import type { DraftPackage } from '@/lib/package-authoring';
import { PackageEditor, type BundleCard } from '@/app/vendor-dashboard/packages/_components/package-editor';
import { BundleMakerLocked } from '@/app/vendor-dashboard/packages/_components/bundle-maker-locked';

const CANONICAL_SERVICES = Object.keys(PACKAGE_CANONICAL_TO_VENDOR_CATEGORY)
  .map((value) => ({ value, label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) }))
  .sort((a, b) => a.label.localeCompare(b.label));

const C1 = '00000000-0000-4000-8000-0000000000c1';
const C4 = '00000000-0000-4000-8000-0000000000c4';
const CARDS: BundleCard[] = [
  {
    id: C1,
    name: 'Mobile Bar by SetnaProd',
    category: 'mobile_bar',
    pricePhp: 110_000,
    discounts: [{ vendor_service_id: C1, discount_type: 'promo', rate: 10, unit: 'pct', min_lead_months: null, expires_at: null, conditions_md: null, sort_order: 0 }],
    inclusions: [
      { label: '2 bartenders' },
      { label: 'Glassware and ice' },
    ],
  },
  {
    id: C4,
    name: 'Mocktail station',
    category: 'mobile_bar',
    pricePhp: 45_000,
    discounts: [],
    inclusions: [
      { label: '2 Bartenders' },
      { label: '4 hours' },
    ],
  },
  { id: '00000000-0000-4000-8000-0000000000c3', name: 'Coffee cart', category: 'coffee_cart', pricePhp: null, discounts: [], inclusions: [] },
];

const FILLED: DraftPackage = {
  package_name: 'Mobile Bar by SetnaProd & Mocktail station',
  total_price_centavos: 0,
  consumable_budget_centavos: 0,
  is_consumable_flexible: false,
  gift: '',
  extra_discount_centavos: 900_000,
  plan: null,
  items: [
    { ref: 'c1', service_description: 'Mobile Bar by SetnaProd', canonical_service: 'mobile_bar', is_default_included: true, is_required: true, replacement_value_centavos: 0, options: [], vendorServiceId: C1 },
    { ref: 'c4', service_description: 'Mocktail station', canonical_service: 'mobile_bar', is_default_included: true, is_required: true, replacement_value_centavos: 0, options: [], vendorServiceId: C4 },
    { ref: 'x1', service_description: 'Welcome drink on arrival', canonical_service: 'mobile_bar', is_default_included: true, is_required: false, replacement_value_centavos: 0, options: [] },
  ],
};

const EMPTY: DraftPackage = {
  package_name: '',
  total_price_centavos: 0,
  consumable_budget_centavos: 0,
  is_consumable_flexible: false,
  gift: '',
  extra_discount_centavos: 0,
  plan: null,
  items: [],
};

/** A fixed clock, so the lab's sums never move with the day. */
const NOW = '2026-11-10T00:00:00.000Z';

export default async function BundleMakerLabPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { s = 'filled' } = await searchParams;
  if (s === 'locked') {
    return <BundleMakerLocked need={{ kind: 'verify', progress: papersProgress({ done: 2, of: 4 }) }} closeHref="/dev/bundle-maker-lab" />;
  }
  const initial = s === 'filled' || s === 'frozen' ? FILLED : EMPTY;
  return (
    <main className="min-h-screen bg-cream">
      <PackageEditor
        key={s}
        packageId={s === 'new' ? undefined : 'lab'}
        initial={initial}
        frozen={s === 'frozen'}
        canonicalServices={CANONICAL_SERVICES}
        cards={s === 'nocards' ? null : CARDS}
        shopName="SetnaProd"
        closeHref="/dev/bundle-maker-lab"
        now={NOW}
        fairWords={LAB_FAIR_WORDS}
      />
    </main>
  );
}
