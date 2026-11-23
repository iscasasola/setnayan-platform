import type { SupabaseClient } from '@supabase/supabase-js';
import { renderUrlQrSvg } from '@/lib/qr';
import { checkADateQr } from '@/lib/check-a-date-qr';
import { siteOrigin } from '@/lib/site-origin';
import { buildVendorInviteUrl, vendorCoverageCategories } from '@/lib/vendor-couple-invite';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import type { VendorCategory } from '@/lib/vendors';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { printQrUrl } from '@/lib/supplier-prints-shop';
import { myQrHref, type PromoteQrMode } from '@/lib/supplier-qr-codes';
import { ownGiftDataOf } from '@/lib/own-clients';
import { fetchOwnLinkGift, fetchShopVerified } from '@/lib/own-clients.server';
import { loadShopGiftsSection } from '../../promote/_components/shop-gifts-data';

/**
 * 🔳 ONE QR, OPENED — its reads (moved from `promote-body.tsx` with the code, 23 Nov 2026). Each code's page reads only
 * what it draws, in one batch:
 *
 *   · every code   — its address (the SAME builders the prints use: `printQrUrl`, so a code and its print never differ)
 *                    and the code itself (`renderUrlQrSvg`; a refused render is `svg: null`, which `QrCard` says).
 *   · Your page · Reviews · Check a date — the own link's gift and the shop's verified state, for the "add a gift to your
 *                    link" notice (`OwnLinkAddGiftNotice`, owner "8. Yes", 16 Nov); Your page also draws the gift itself
 *                    (`OwnLinkGift`) and so reads the gift stock.
 *   · Shortlist    — its two picks: the kind of event a scan starts and the service they shortlist you as.
 *
 * A refused gift or verified read stays `'unread'` / `null` — never "no gift", never "not verified".
 */
export type QrPick = { key: string; label: string; href: string };

export type MyQrCodeData = {
  code: PromoteQrMode;
  url: string;
  svg: string | null;
  shopName: string;
  /** Show the "add a gift to your link" notice — a VERIFIED shop whose link has no gift (proven, never on a refused read). */
  addGiftNotice: boolean;
  shortlist: { eventPick: { value: string; options: QrPick[] }; servicePick: { value: string; options: QrPick[] }; scope: string } | null;
  ownGift: { verified: boolean | null; data: ReturnType<typeof ownGiftDataOf>; current: { code: string; title: string } | null | 'unread' } | null;
};

export async function loadMyQrCode(
  supabase: SupabaseClient,
  shop: { vendorProfileId: string; slug: string; shopName: string; services: string[] },
  code: PromoteQrMode,
  search: { et?: string; cat?: string },
): Promise<MyQrCodeData> {
  const origin = siteOrigin();
  const own = code !== 'shortlist';

  if (code === 'shortlist') {
    const [eventTypes, kindLabel] = await Promise.all([getCreatableEventTypes(), cardKindLabeller()]);
    const coverage = vendorCoverageCategories(shop.services);
    const cat = search.cat && coverage.includes(search.cat as VendorCategory) ? (search.cat as VendorCategory) : null;
    const et = search.et && eventTypes.some((t) => t.key === search.et) ? search.et : null;
    const url = buildVendorInviteUrl(shop.slug, { eventType: et, category: cat });
    const svg = await renderUrlQrSvg(url, 220).catch(() => null);
    const etLabel = eventTypes.find((t) => t.key === et)?.label ?? null;
    return {
      code,
      url,
      svg,
      shopName: shop.shopName,
      addGiftNotice: false,
      ownGift: null,
      shortlist: {
        eventPick: {
          value: et ?? 'any',
          options: [{ key: 'any', label: 'Any event', href: myQrHref('shortlist', { cat }) }, ...eventTypes.map((t) => ({ key: t.key, label: t.label, href: myQrHref('shortlist', { et: t.key, cat }) }))],
        },
        servicePick: {
          value: cat ?? 'all',
          options: [{ key: 'all', label: 'All my services', href: myQrHref('shortlist', { et }) }, ...coverage.map((c) => ({ key: c, label: kindLabel(c), href: myQrHref('shortlist', { et, cat: c }) }))],
        },
        scope: `${cat ? ` as ${kindLabel(cat)}` : ''}${etLabel ? ` on their ${etLabel.toLowerCase()} plan` : ''}`,
      },
    };
  }

  // 📅 Check a date is the shop's one permanent code — its own builder (`checkADateQr`), as on Promote before.
  const dates = code === 'dates' ? await checkADateQr(shop.slug, origin) : null;
  const url = dates ? dates.url : printQrUrl(code, origin, shop.slug, 'link'); // 🏷 an on-screen code: via=link (#7881)
  const [svg, verified, ownLink, gifts] = await Promise.all([
    dates ? Promise.resolve(dates.svg) : renderUrlQrSvg(url, 220).catch(() => null),
    // 🪪 The ONE verified test the server uses; null = couldn't check (never "not verified", never a promise).
    own ? fetchShopVerified(supabase, shop.vendorProfileId) : Promise.resolve(null),
    own ? fetchOwnLinkGift(supabase, shop.vendorProfileId) : Promise.resolve(null),
    code === 'page' ? loadShopGiftsSection(supabase, shop.vendorProfileId) : Promise.resolve(null),
  ]);
  return {
    code,
    url,
    svg,
    shopName: shop.shopName,
    addGiftNotice: verified === true && ownLink === null,
    shortlist: null,
    ownGift: gifts
      ? {
          verified,
          data: ownGiftDataOf(gifts),
          current: ownLink === 'unread' || ownLink === null ? ownLink : { code: ownLink.service_code, title: ownLink.title },
        }
      : null,
  };
}
