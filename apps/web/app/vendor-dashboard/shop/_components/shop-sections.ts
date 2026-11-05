/**
 * SHOP'S SECTIONS — Details · Services · Page · Portfolio · Analytics, ONCE (supplier dashboard v13, APPROVED 2026-10-29;
 * prototype `pickMenu(..., {title:'Shop'})`, its words for each line). A plain module — no client boundary — so the
 * pinned row (`shop-segments.tsx`), the bar's page menu from 701 (`supplier-page-menu.tsx`), the tour router and the
 * guards all read the SAME list. Each section keeps its own address, so a bookmark, a back press and a link from
 * anywhere land on the same view.
 *
 * 🔑 THE KEY `insights` STAYS: the tour, the rail and the guards key on it. Only its word changed ("How it is going" →
 * "Analytics", v13). Details and Gallery are the screens step 5 opened from Page (Your details · Your collections),
 * now named in the menu itself.
 */
export type ShopSegment = 'details' | 'services' | 'page' | 'gallery' | 'insights';

export const SHOP_SEGMENT_ORDER: readonly ShopSegment[] = ['details', 'services', 'page', 'gallery', 'insights'];

export const SHOP_SEGMENT_HREF: Readonly<Record<ShopSegment, string>> = {
  details: '/vendor-dashboard/profile',
  services: '/vendor-dashboard/shop',
  page: '/vendor-dashboard/website',
  gallery: '/vendor-dashboard/collections',
  insights: '/vendor-dashboard/performance',
};

export const SHOP_SEGMENT_LABEL: Readonly<Record<ShopSegment, string>> = {
  details: 'Details',
  services: 'Services',
  page: 'Page',
  // 🖼 "Portfolio", not the prototype's "Gallery": owner 2026-10-23 — no "gallery" in the UI; a supplier's own photos
  // are their Portfolio (`lib/no-gallery-word.test.ts`). The KEY stays `gallery` (the prototype's own section name).
  gallery: 'Portfolio',
  insights: 'Analytics',
};

/** The one short line under each choice in the ▾ — the prototype's own words. */
export const SHOP_SEGMENT_HINT: Readonly<Record<ShopSegment, string>> = {
  details: 'Name · what you do · documents',
  services: 'Cards · tools · scanner, set once',
  page: 'What couples see',
  gallery: 'Photos and videos · albums',
  insights: 'How you stand · what to improve · badges',
};
