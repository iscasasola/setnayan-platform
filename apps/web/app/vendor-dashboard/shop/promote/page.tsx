import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { renderUrlQrSvg } from '@/lib/qr';
import { checkADateQr } from '@/lib/check-a-date-qr';
import { buildVendorInviteUrl, vendorCoverageCategories } from '@/lib/vendor-couple-invite';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import type { VendorCategory } from '@/lib/vendors';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { siteOrigin } from '@/lib/site-origin';
import { PROMOTE_HREF, PROMOTE_QR_MODES, SUPPLIER_QR_MODE_LABEL, myPageUrl, promoteQrModeOf, type PromoteQrMode } from '@/lib/supplier-qr-codes';
import { ShopSegments } from '../_components/shop-segments';
import { shopGearBody } from '../_components/shop-settings-body';
import { QrCodes, type QrPick } from '../../invite/_components/qr-codes';
import { promoteFigures } from '@/lib/shop-section-figures';
import { ShopGiftsSection } from './_components/shop-gifts-section';
import { loadShopGiftsSection } from './_components/shop-gifts-data';
import { ShareYourWork } from './_components/share-your-work';
import { loadShareYourWork } from './_components/share-your-work-data';

export const metadata = { title: 'Promote · Shop · Supplier' };
export const dynamic = 'force-dynamic';

/**
 * 📣 SHOP › PROMOTE — one place for every tool that markets the shop (owner 2026-11-05: the supplier's QR codes do NOT
 * belong under Customers; they belong in Shop, beside the website, print materials and gifts. Owner, verbatim: "So the
 * location of our for page is correct" — the For Suppliers page already presents them that way).
 *
 * PART 1 — the three marketing codes MOVED here from Customers › QR codes, same component, same words, same behaviour:
 *   • Shortlist · free     — stateless slug invite; a scan imports the shop onto the couple's shortlist under the picked
 *                            event type + service (`buildVendorInviteUrl`).
 *   • Check a date · free  — the shop's one permanent code → `/v/<slug>/dates` (`lib/check-a-date-qr.ts`).
 *   • My page              — the shop's own Setnayan page → `/v/<slug>` (`lib/supplier-qr-codes.ts`).
 * Booked · one-use and Crew for an event stay on Customers › QR codes (`/vendor-dashboard/invite`), which forwards any
 * of these three here.
 *
 * PART 2 — 🎁 YOUR GIFTS MOVED here from the Plan page, same component, same words, same behaviour (`ShopGiftsSection`:
 * the gift stock, Buy gifts, Bought). Its reads moved with it (`loadShopGiftsSection`), and the pinned row's ONE figure is
 * that read's `stock.balance` (`promoteFigures`) — never typed. Giving a gift on a quote stays in the quote
 * (`quote-shop-gifts.tsx`); the admin ledger stays on Admin › Gifts. Prints join in a later part.
 *
 * ROW 4 — 📣 SHARE YOUR WORK (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL": *"Make the pages live
 * there and not jump to another menu"*): the stories + recaps a couple made public, with their share / story-card
 * buttons (`ShareYourWork`, reads `loadShareYourWork`). `/vendor-dashboard/real-stories` and `/vendor-dashboard/recaps`
 * forward to `#share`; they left Settings › More tools.
 *
 * Server component: every word arrives read. 🔒 lib/supplier-qr-codes.test.ts · shop/the-shop-sections-are-v13.test.ts ·
 * shop/promote/gifts-live-on-promote.test.ts
 */
export default async function ShopPromotePage({
  searchParams,
}: {
  searchParams: Promise<{ et?: string; cat?: string; mode?: string; gear?: string }>;
}) {
  const search = await searchParams;
  const mode: PromoteQrMode = promoteQrModeOf(search.mode);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // The codes encode the shop's public address — minted by a trigger the moment a shop is named (the twin note on
  // Customers › QR codes, `invite/page.tsx`: gating on `is_published` asked for a button suppliers do not have).
  const slug = (profile as { business_slug?: string | null }).business_slug ?? null;
  const canShare = Boolean(slug);
  const shopName = (profile as { business_name?: string | null }).business_name?.trim() || 'Your shop';
  // 🎁 Read alongside the codes (part 2): the gifts section and the row's figure share this one result.
  const giftsPromise = loadShopGiftsSection(supabase, profile.vendor_profile_id);
  // Awaited below; this only keeps a throw from being "unhandled" while the codes are drawn — it still surfaces there.
  giftsPromise.catch(() => undefined);
  // 📣 Row 4 — read beside the gifts; the loader says a refused read in words (never throws).
  const sharePromise = loadShareYourWork(supabase, profile.vendor_profile_id);
  const modeOptions: QrPick[] = PROMOTE_QR_MODES.map((key) => ({ key, label: SUPPLIER_QR_MODE_LABEL[key], href: `${PROMOTE_HREF}?mode=${key}` }));
  const common = { place: 'promote' as const, backHref: PROMOTE_HREF, modeOptions, setupHref: '/vendor-dashboard/shop', booked: null };

  let body;
  if (!canShare) {
    body = <QrCodes {...common} mode={mode} canShare={false} shortlist={null} />;
  } else if (mode === 'dates') {
    body = <QrCodes {...common} mode="dates" canShare shortlist={null} checkADate={{ ...(await checkADateQr(slug!)), shopName }} />;
  } else if (mode === 'page') {
    const url = myPageUrl(siteOrigin(), slug!);
    body = <QrCodes {...common} mode="page" canShare shortlist={null} myPage={{ url, svg: await renderUrlQrSvg(url, 220).catch(() => null), shopName }} />;
  } else {
    const kindLabel = await cardKindLabeller();
    const profileServices = ((profile as { services?: string[] | null }).services ?? []) as string[];
    const eventTypes = await getCreatableEventTypes();
    const coverage = vendorCoverageCategories(profileServices);
    const selectedCat = search.cat && coverage.includes(search.cat as VendorCategory) ? (search.cat as VendorCategory) : null;
    const selectedEt = search.et && eventTypes.some((t) => t.key === search.et) ? search.et : null;
    const url = buildVendorInviteUrl(slug!, { eventType: selectedEt, category: selectedCat });
    const svg = await renderUrlQrSvg(url, 220).catch(() => null);
    const href = (et: string | null, cat: string | null) => {
      const q = new URLSearchParams({ mode: 'shortlist' });
      if (et) q.set('et', et);
      if (cat) q.set('cat', cat);
      return `${PROMOTE_HREF}?${q.toString()}`;
    };
    const etLabel = eventTypes.find((t) => t.key === selectedEt)?.label ?? null;
    body = (
      <QrCodes
        {...common}
        mode="shortlist"
        canShare
        shortlist={{
          url,
          svg,
          shopName,
          eventPick: {
            value: selectedEt ?? 'any',
            options: [{ key: 'any', label: 'Any event', href: href(null, selectedCat) }, ...eventTypes.map((t) => ({ key: t.key, label: t.label, href: href(t.key, selectedCat) }))],
          },
          servicePick: {
            value: selectedCat ?? 'all',
            options: [{ key: 'all', label: 'All my services', href: href(selectedEt, null) }, ...coverage.map((c) => ({ key: c, label: kindLabel(c), href: href(selectedEt, c) }))],
          },
          scope: `${selectedCat ? ` as ${kindLabel(selectedCat)}` : ''}${etLabel ? ` on their ${etLabel.toLowerCase()} plan` : ''}`,
        }}
      />
    );
  }

  const [gifts, share] = await Promise.all([giftsPromise, sharePromise]);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-32 pt-4 sm:px-6" data-supplier-promote="">
      <ShopSegments on="promote" figures={promoteFigures({ giftCredits: gifts.stock ? gifts.stock.balance : null })} gearBody={shopGearBody(search)} />
      {body}
      <ShopGiftsSection data={gifts} />
      <ShareYourWork data={share} />
    </section>
  );
}
