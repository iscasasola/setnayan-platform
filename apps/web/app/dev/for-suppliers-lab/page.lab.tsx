/**
 * /dev/for-suppliers-lab — the REAL `SupplierFrontPage` (the owner-APPROVED redesign of 23 Nov 2026, specs
 * `prototypes/for_suppliers_redesign_2026-11-23/` v4.3.1) with its reads filled in, for the side-by-side with the
 * drawing. DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`), the same kill-switch as every lab.
 *
 * Why it exists: a local checkout runs on a dummy env (never production's — `a-builders-lab-env-points-at-production`),
 * so the live page reads nothing and shows its honest "couldn't read" states. Here:
 *   · the plan prices are LAB PLACEHOLDERS (₱ · · ·) — no supplier price is typed;
 *   · the fee is the code default schedule;
 *   · the gifts are a LAB FIXTURE shaped like the catalogue rows the live page reads (`fetchShopGiftPacks`), taken from
 *     `platform_retail_catalog_v2` on 23 Nov 2026 so the shot matches what production draws. Labs may carry sample data
 *     (`no-typed-price-on-a-customer-screen.test.ts` leaves `app/dev` out); the live page never reads this file.
 *
 * States: `?gifts=unread` (the gift read failed) · `?fee=unread` (the fee schedule could not be read) ·
 * `?tools=paid` / `?tools=unread` (the special tools' start date passed / unread).
 */
import { notFound } from 'next/navigation';
import '@/app/_components/frontdoor/front-door.css';
import { SupplierFrontPage, type SupplierFrontGifts } from '@/app/for-suppliers/_components/supplier-front-page';
import { BOOKING_FEE } from '@/lib/booking-fee';
import type { ShopGiftPack } from '@/lib/shop-gifts';

/** LAB FIXTURE — a visible placeholder, never a typed supplier price. */
const LAB_PRICES = {
  soloMonthly: '₱ · · ·',
  proMonthly: '₱ · · ·',
  enterpriseMonthly: '₱ · · ·',
  branch: '₱ · · ·',
  seat: '₱ · · ·',
  bySku: new Proxy({} as Record<string, string | null>, { get: () => '₱ · · ·' }),
};

/** LAB FIXTURE — the three gift rows as the catalogue held them on 23 Nov 2026 (shape of `ShopGiftPack`). */
const LAB_PACKS: ShopGiftPack[] = [
  { code: 'PAPIC_GUEST_150', title: 'Papic 150', kind: 'papic', credits: 150, srpCentavos: 9_900 },
  { code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 299_000 },
  { code: 'COUPLE_WEBSITE_PRO', title: 'Event Pro', kind: 'event_pro', credits: 1, srpCentavos: 549_000 },
];
const LAB_GIFTS: SupplierFrontGifts = {
  packs: LAB_PACKS,
  bundles: [{ code: 'GIFT_BUNDLE_PAPIC_GUEST_150', title: 'Papic 150 · 10 + 1', pack: LAB_PACKS[0]!, quantity: 11, priceCentavos: 99_000 }],
  credits: { plusCredits: 1_000, proCredits: 3_000 },
};
/** LAB FIXTURE — the seeded starting card templates (migration 20271351904391); `?templates=unread` = a refused count. */
const LAB_CARD_TEMPLATES = 321;
const UNREAD_GIFTS: SupplierFrontGifts = { packs: null, bundles: null, credits: { plusCredits: null, proCredits: null } };

export default async function ForSuppliersLabPage({ searchParams }: { searchParams: Promise<{ gifts?: string; fee?: string; papic?: string; templates?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  // `?papic=1` lists the Papic camera in the Toolkit sheet, as production does once its privacy switch is on.
  const papicCapture = q.papic === '1';
  return (
    // `.fd` + front-door.css: the shell's tokens and Discover's button, as the real route wears them inside the shell.
    <main className="fd" style={{ ['--fd-bar' as string]: '0px' }}>
      <SupplierFrontPage
        prices={LAB_PRICES}
        fee={{ schedule: q.fee === 'unread' ? null : BOOKING_FEE, enabled: true }}
        gifts={q.gifts === 'unread' ? UNREAD_GIFTS : LAB_GIFTS}
        paywallOn={false}
        papicCapture={papicCapture}
        cardTemplates={q.templates === 'unread' ? null : LAB_CARD_TEMPLATES}
      />
    </main>
  );
}
