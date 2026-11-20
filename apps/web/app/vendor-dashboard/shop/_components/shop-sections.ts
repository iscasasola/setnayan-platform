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
export type ShopSegment = 'details' | 'services' | 'page' | 'promote' | 'gallery' | 'insights' | 'templates' | 'tools';

/**
 * 📣 + PROMOTE (owner 2026-11-05): the shop's marketing tools in ONE place — its QR codes first (moved from Customers ›
 * QR codes), then the gift stock (moved from the Plan page, part 2), then prints. It sits right after Page, "beside the website" in the owner's words.
 */
export const SHOP_SEGMENT_ALL: readonly ShopSegment[] = ['details', 'gallery', 'templates', 'tools', 'insights', 'services', 'page', 'promote'];

/**
 * 🧭 THE MENU FOLLOWS THE PAGE (owner 19 Nov 2026, "Yes, all three"; drawing `shop_final_with_spaces_2026-11-19`, Part 8):
 * Details and Portfolio are their own screens, so they lead; the rest jump down the Shop tab in its own order —
 * Templates · Specialized tools · Analytics · Bundles and services. PAGE AND PROMOTE LEFT THE MENU: View shop and the
 * Promote button on the cover already open them, and one thing has one door. Their keys, words and addresses stay
 * (`SHOP_SEGMENT_ALL`) because their own screens still say "Shop · Page" / "Shop · Promote" on the pinned row.
 */
export const SHOP_SEGMENT_ORDER: readonly ShopSegment[] = ['details', 'gallery', 'templates', 'tools', 'insights', 'services'];

export const SHOP_SEGMENT_HREF: Readonly<Record<ShopSegment, string>> = {
  details: '/vendor-dashboard/profile',
  services: '/vendor-dashboard/shop',
  page: '/vendor-dashboard/website',
  promote: '/vendor-dashboard/shop/promote',
  gallery: '/vendor-dashboard/collections',
  // 🎠 Analytics IS the Shop carousel (owner 11 Nov 2026) — the old page folded into it.
  insights: '/vendor-dashboard/shop#analytics',
  templates: '/vendor-dashboard/shop#makers',
  tools: '/vendor-dashboard/shop#tools',
};

/** Where ONE Analytics lives — the carousel on the Shop tab (owner 11 Nov 2026, *"Analytics should be the carousel"*). */
export const ONE_ANALYTICS_HREF = '/vendor-dashboard/shop#analytics';

export const SHOP_SEGMENT_LABEL: Readonly<Record<ShopSegment, string>> = {
  details: 'Details',
  // 🏷 Owner 2026-11-09: "Your Bundles and Services instead of Your services" — the section and its head say both.
  services: 'Bundles and services',
  page: 'Page',
  promote: 'Promote',
  // 🖼 "Portfolio", not the prototype's "Gallery": owner 2026-10-23 — no "gallery" in the UI; a supplier's own photos
  // are their Portfolio (`lib/no-gallery-word.test.ts`). The KEY stays `gallery` (the prototype's own section name).
  gallery: 'Portfolio',
  insights: 'Analytics',
  templates: 'Templates',
  tools: 'Specialized tools',
};

/** The one short line under each choice in the ▾ — the prototype's own words. */
export const SHOP_SEGMENT_HINT: Readonly<Record<ShopSegment, string>> = {
  details: 'Name · what you do · documents',
  services: 'Your bundles · your service cards',
  page: 'What couples see',
  promote: 'QR codes · prints · gifts · share your work',
  gallery: 'Photos and videos · albums',
  insights: 'How you stand · what to improve · badges',
  templates: 'Forms · offers',
  tools: 'Scanner · the tools you run on the day',
};
