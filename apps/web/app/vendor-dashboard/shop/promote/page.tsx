import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { ShopSegments } from '../_components/shop-segments';
import { shopGearBody } from '../_components/shop-settings-body';
import { promoteFigures } from '@/lib/shop-section-figures';
import { loadShopGiftsSection } from './_components/shop-gifts-data';
import { PromoteBody } from './_components/promote-body';

export const metadata = { title: 'Promote · Shop · Supplier' };
export const dynamic = 'force-dynamic';

/**
 * 📣 SHOP › PROMOTE — one place for every tool that markets the shop (owner 2026-11-05: the supplier's QR codes do NOT
 * belong under Customers; they belong in Shop, beside the website, print materials and gifts. Owner, verbatim: "So the
 * location of our for page is correct" — the For Suppliers page already presents them that way).
 *
 * PART 1 — 🔳 QR CODES, ONE LIST (Option B, owner 2026-11-06 *"B"*): a row per code — Check a date · Shortlist · My page
 * · Reviews — each opening its sheet (Share · Copy link · Download · Write to NFC · Put it on… Door print / Prints).
 * The three below were the dropdown's choices before it; they MOVED here from Customers › QR codes:
 *   • Shortlist · free     — stateless slug invite; a scan imports the shop onto the couple's shortlist under the picked
 *                            event type + service (`buildVendorInviteUrl`).
 *   • Check a date · free  — the shop's one permanent code → `/v/<slug>/dates` (`lib/check-a-date-qr.ts`).
 *   • My page              — the shop's own Setnayan page → `/v/<slug>` (`lib/supplier-qr-codes.ts`).
 * Booked · one-use and Crew for an event stay on Customers › QR codes (`/vendor-dashboard/invite`), which forwards any
 * of these three here.
 *
 * PART 2 — 🎁 YOUR GIFTS MOVED here from the Plan page, same component, same words, same behaviour (`ShopGiftsSection`:
 * the gift stock, Buy gifts, Bought). Its reads moved with it (`loadShopGiftsSection`), and the pinned row's ONE figure is
 * that read's `stock.papic.balance` (`promoteFigures`) — never typed. Giving a gift on a quote stays in the quote
 * (`quote-shop-gifts.tsx`); the admin ledger stays on Admin › Gifts.
 *
 * PART 3 — 🖨 PRINTS (owner APPROVED the 15 looks, 5 Nov 2026 — Setnayan-specs `prototypes/supplier_prints_2026-11-05/`):
 * a row "Calling card + tarps" → one sheet: Design ▾ (15 looks) · QR on your prints ▾ (the codes above: Check a date ·
 * Shortlist · My page) · the 7 pieces, each with Save (a print-ready file, `/api/vendor/prints`) · See it in use (the
 * look + QR placed on real event photos). `ShopPrintsSection`; the drawing is `lib/supplier-prints-svg.ts`.
 *
 * ROW 4 — 📣 SHARE YOUR WORK (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL": *"Make the pages live
 * there and not jump to another menu"*): the stories + recaps a couple made public, with their share / story-card
 * buttons (`ShareYourWork`, reads `loadShareYourWork`). `/vendor-dashboard/real-stories` and `/vendor-dashboard/recaps`
 * forward to `#share`; they left Settings › More tools.
 *
 * Server component: every word arrives read. 🔒 lib/supplier-qr-codes.test.ts · shop/the-shop-sections-are-v13.test.ts ·
 * shop/promote/gifts-live-on-promote.test.ts · lib/supplier-prints.test.ts · lib/supplier-prints-decode.test.ts
 */
export default async function ShopPromotePage({
  searchParams,
}: {
  searchParams: Promise<{ et?: string; cat?: string; mode?: string; gear?: string }>;
}) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // 🎁 The gift stock: the pinned row's ONE figure AND the gifts section — one read, handed to the body.
  const giftsPromise = loadShopGiftsSection(supabase, profile.vendor_profile_id);
  giftsPromise.catch(() => undefined);
  const gifts = await giftsPromise;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-32 pt-4 sm:px-6" data-supplier-promote="">
      <ShopSegments on="promote" figures={promoteFigures({ giftCredits: gifts.stock ? gifts.stock.papic.balance : null })} gearBody={shopGearBody(search)} />
      {/* 📣 ONE body (THE ONE BUILD A3 W5): the same component Shop's Promote and QR sheets mount (`promote-body.tsx`). */}
      <PromoteBody search={search} part="all" gifts={giftsPromise} />
    </section>
  );
}
