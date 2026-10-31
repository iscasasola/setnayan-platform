'use client';

/**
 * 📌 THE PAGE MENU ▾ — the LEFT of the supplier's pinned row from 701 (supplier dashboard v13, owner 2026-10-29 "desktop
 * mode is wrong" · "and tablet"; prototype approved "Approved."; DECISION_LOG 2026-10-29 "SUPPLIER DASHBOARD — LAST
 * ROUND OF OWNER NOTES" item 12). The house contract: pinned row = LEFT one menu, RIGHT action rounds only, NO centre
 * title — the ▾ names the page ("Customers · Dates ▾").
 *
 * It names the four tabs' OWN sections from their ONE source each — never a copied list:
 *   · Customers — `CUSTOMER_SEGMENTS` / `CUSTOMER_SEGMENT_HREFS` (`customers/segments.ts`);
 *   · Shop      — `SHOP_SEGMENT_ORDER` / `SHOP_SEGMENT_HREF` / `SHOP_SEGMENT_LABEL` (`shop/_components/shop-sections.ts`,
 *                 v13: Details · Services · Page · Gallery · Analytics).
 * Today has no sections in an address yet, so it is a plain word — no ▾, no frame (a ▾ that opens nothing
 * is a fake door; a frame on a word that does nothing breaks "frames only on pressable things"). The page builders
 * (S3–S6) widen a tab's list by adding to that tab's own source, not here.
 *
 * Drawn in the shell's bar (`pinnedBar.lead`), which only shows from 701 — below that the phone keeps the page's own
 * picker exactly as shipped. From 701 the page's own picker for the same choice is the duplicate, so it steps aside
 * (`supplier-frame.css`). 🔒 the-supplier-frame-holds.test.ts
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { CUSTOMER_SEGMENTS, CUSTOMER_SEGMENT_HREFS, CUSTOMER_SEGMENT_LABEL, customersSegmentOf } from '../customers/segments';
import { SHOP_SEGMENT_HREF, SHOP_SEGMENT_LABEL, SHOP_SEGMENT_ORDER } from '../shop/_components/shop-sections';
import { VENDOR_DESTINATIONS, VENDOR_SHOP_EXTRA_MATCH } from './vendor-nav-destinations';

type MenuSection = { key: string; label: string; href: string };
export type SupplierPageMenuModel = { tab: string; section: string | null; sections: readonly MenuSection[] | null };

const startsWith = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Where the supplier stands → the tab's word, the section now on screen and the tab's sections. Pure, so the guard can
 * walk every address without a browser. `null` = not one of the four tabs' pages (Settings, a notification) — the bar
 * then draws no menu rather than guessing a name.
 */
export function supplierPageMenuOf(path: string, seg: string | null): SupplierPageMenuModel | null {
  if (startsWith(path, '/vendor-dashboard/customers')) {
    const on = customersSegmentOf({ seg: seg ?? undefined });
    return {
      tab: 'Customers',
      section: CUSTOMER_SEGMENT_LABEL[on],
      sections: CUSTOMER_SEGMENTS.map((s) => ({ key: s, label: CUSTOMER_SEGMENT_LABEL[s], href: CUSTOMER_SEGMENT_HREFS[s] })),
    };
  }
  const shopOn = SHOP_SEGMENT_ORDER.find((s) => path === SHOP_SEGMENT_HREF[s]) ?? null;
  if (shopOn || startsWith(path, '/vendor-dashboard/shop') || VENDOR_SHOP_EXTRA_MATCH.some((p) => startsWith(path, p))) {
    return {
      tab: 'Shop',
      section: shopOn ? SHOP_SEGMENT_LABEL[shopOn] : null,
      sections: SHOP_SEGMENT_ORDER.map((s) => ({ key: s, label: SHOP_SEGMENT_LABEL[s], href: SHOP_SEGMENT_HREF[s] })),
    };
  }
  if (path === '/vendor-dashboard') return { tab: 'Today', section: null, sections: null };
  const hub = VENDOR_DESTINATIONS.find((d) => d.key === 'on-the-day');
  if (hub && startsWith(path, hub.href)) return { tab: hub.label, section: null, sections: null };
  return null;
}

const hubLabel = () => VENDOR_DESTINATIONS.find((d) => d.key === 'on-the-day')?.label ?? null;

export function SupplierPageMenu({
  path: pathOverride,
}: {
  /** A fixture page (the dev lab) names the address it draws — `/vendor-dashboard/customers?seg=dates`. */
  path?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [overPath, overQuery] = (pathOverride ?? '').split('?');
  const model = pathOverride
    ? supplierPageMenuOf(overPath ?? '', new URLSearchParams(overQuery ?? '').get('seg'))
    : supplierPageMenuOf(pathname ?? '', params?.get('seg') ?? null);
  if (!model) return null;
  const face = model.section ? `${model.tab} · ${model.section}` : model.tab;
  // 🗓 The Hub's ▾ is its EVENTS, which only the page has read: the page's own `HubEventMenu` portals into this slot
  // from 701 and the plain word steps aside (`supplier-frame.css`). No event, no menu — the word stays.
  if (model.tab === hubLabel()) {
    return (
      <span className="min-w-0" data-pin-lead-hub="">
        <span className="truncate px-1 text-[15px] font-semibold text-ink" data-supplier-page-menu="word">
          {face}
        </span>
      </span>
    );
  }
  if (!model.sections) {
    return (
      <span className="truncate px-1 text-[15px] font-semibold text-ink" data-supplier-page-menu="word">
        {face}
      </span>
    );
  }
  const current = model.sections.find((s) => s.label === model.section) ?? null;
  return (
    <span className="min-w-0" data-supplier-page-menu="menu">
      <PickMenu
        label={`${model.tab} — show`}
        value={current?.key ?? null}
        buttonText={face}
        options={model.sections.map((s) => ({ key: s.key, label: s.label }))}
        compact
        dataAttr="data-supplier-page-pick"
        onPick={(k) => {
          const to = model.sections?.find((s) => s.key === k);
          if (to && to.key !== current?.key) router.push(to.href, { scroll: false });
        }}
      />
    </span>
  );
}
