/**
 * /dev/bundle-maker-lab — THE BUNDLE MAKER (`packages/_components/package-editor.tsx`) on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`), the production check first.
 *
 * It draws the REAL `PackageEditor` under the same head the real page draws, for the side-by-side with the approved
 * prototype `makers_match_2026-11-07` § 4 (Bundle maker). Nothing here posts anywhere useful: with no session the
 * shipped save refuses.
 *
 *   ?s=filled   two cards, one extra line, a shop pack as the gift, More settings open (default — the prototype's frame)
 *   ?s=new      a new, empty bundle
 *   ?s=nocards  the card read was refused — the maker says so instead of offering nothing
 *
 * Names are the prototype's samples: nobody real. No price is typed for a card or a pack: card from-prices are shown
 * as "₱ —" (null), and a pack's list price is never drawn by the maker.
 */
import { LAB_FAIR_WORDS } from '../lab-fair-words';
import { notFound } from 'next/navigation';
import { PACKAGE_CANONICAL_TO_VENDOR_CATEGORY } from '@/lib/vendor-packages';
import type { DraftPackage } from '@/lib/package-authoring';
import type { ShopGiftPack } from '@/lib/shop-gifts';
import { PackageEditor, type BundleCard } from '@/app/vendor-dashboard/packages/_components/package-editor';

const CANONICAL_SERVICES = Object.keys(PACKAGE_CANONICAL_TO_VENDOR_CATEGORY)
  .map((value) => ({ value, label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) }))
  .sort((a, b) => a.label.localeCompare(b.label));

const CARDS: BundleCard[] = [
  { id: '00000000-0000-4000-8000-0000000000c1', name: 'Catering', category: 'catering', fromPhp: null },
  { id: '00000000-0000-4000-8000-0000000000c2', name: 'Lechon', category: 'lechon', fromPhp: null },
  { id: '00000000-0000-4000-8000-0000000000c3', name: 'Cake', category: 'cake', fromPhp: null },
];

/** The pack SHAPES the catalogue gives; the money fields are never drawn by the maker, so they are left at 0 here. */
const PACKS: ShopGiftPack[] = [
  { code: 'PAPIC_GUEST', title: 'Papic credits · your smallest pack', kind: 'papic', credits: 150, srpCentavos: 0, giftPriceCentavos: null },
  { code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 0, giftPriceCentavos: null },
  { code: 'COUPLE_WEBSITE_PRO', title: 'Event Pro', kind: 'event_pro', credits: 1, srpCentavos: 0, giftPriceCentavos: null },
];

const FILLED: DraftPackage = {
  package_name: 'Catering & Lechon',
  total_price_centavos: 0,
  consumable_budget_centavos: 0,
  is_consumable_flexible: true,
  gift: 'PAPIC_GUEST',
  items: [
    { ref: 'c1', service_description: 'Catering', canonical_service: 'catering', is_default_included: true, is_required: true, replacement_value_centavos: 0, options: [], vendorServiceId: CARDS[0]!.id },
    { ref: 'c2', service_description: 'Lechon', canonical_service: 'lechon', is_default_included: true, is_required: true, replacement_value_centavos: 0, options: [], vendorServiceId: CARDS[1]!.id },
    { ref: 'x1', service_description: 'Crew meals for your staff', canonical_service: 'catering', is_default_included: true, is_required: false, replacement_value_centavos: 0, options: [] },
  ],
};

const EMPTY: DraftPackage = {
  package_name: '',
  total_price_centavos: 0,
  consumable_budget_centavos: 0,
  is_consumable_flexible: false,
  gift: '',
  items: [],
};

export default async function BundleMakerLabPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { s = 'filled' } = await searchParams;
  const initial = s === 'filled' ? FILLED : EMPTY;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-36 pt-8 sm:px-6">
      <h1 className="font-serif text-2xl text-ink/90">Your bundle</h1>
      <p className="mb-6 mt-1 text-[14px] text-ink/60">Several service cards as one package.</p>
      <PackageEditor
        key={s}
        initial={initial}
        isActive={false}
        frozen={false}
        canonicalServices={CANONICAL_SERVICES}
        cards={s === 'nocards' ? null : CARDS}
        giftPacks={PACKS}
        giftFree={{ papic: 850, event_plus: 2, event_pro: 0 }}
        shopName="Kusina ni Aling Nena"
        fairWords={LAB_FAIR_WORDS}
      />
    </main>
  );
}
