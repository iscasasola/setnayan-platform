/**
 * ADMIN HELP SLOT H8 — admin areas A18–A28 — Catalogue, Insights, the avatar menu. INTERNAL: for the Setnayan team, never the public.
 *
 * Owned by ONE answer-writing session (H8); no other session edits this file.
 * Covers: the catalogue (categories, pricing, price bands, add-ons, songs, hub music, colours, menus) · insights (funnels, growth, insights, intelligence, demand, app performance) · the avatar menu (settings, secrets, integrations, website, SEO).
 * Where those live: app/admin (categories, pricing, price-bands, addons, songs, hub-music, colours, menus, funnels, growth, insights, intelligence, demand, app-performance, settings, secrets, integrations, website, seo).
 *
 * ⛔ Behind the same wall as lib/help-admin.ts: only lib/help-admin.ts may import
 * this file, and only app/admin/** may import that
 * (lib/public-help-says-what-is-true.test.ts). Never import it from lib/help.ts.
 * Every slug is globally unique across lib/help/ and lib/help-admin/
 * (lib/help-slugs-are-unique.test.ts).
 */
import type { AdminHelpTopic } from '@/lib/help-admin';

/*
 * H8 · 2026-11-14 — INTERNAL. Every answer below was checked against origin/main; the code that proves it is named in
 * the comment above it (a greppable string, never a line number). No price, VAT rate or sample size is typed. The
 * one-admin price paths found here (supplier plan prices, bulk price tools) are written up in admin-1.ts
 * ('admin-what-two-admins-really-enforce') and in the H7 PR body.
 */
export const ADMIN_2_TOPICS: AdminHelpTopic[] = [
  {
    key: 'admin-catalogue',
    label: 'Catalogue',
    audience: 'admin',
    articles: [
      {
        // app/admin/categories ("+ Add", "Export categories (CSV)"); app/admin/categories/requests
        slug: 'admin-categories',
        title: 'Where are supplier categories, event types and religions?',
        body: 'Catalogue › Categories: choose the list, then add in place. Catalogue ⚙ › Export categories (CSV) downloads them. Service requests collects shops asking for a new service — when several asked for the same one, one decision answers them all.',
      },
      {
        // Catalogue › Prices "Save this price"; lib/retail-price-change.ts CUSTOMER_PRICE_FIELDS (approve_retail_price_change); platform_retail_catalog_v2
        slug: 'admin-change-a-customer-price',
        title: 'How do I change what a customer pays?',
        body: 'Catalogue › Prices, open the row and Save this price. Words and descriptions save at once; a change to a price field (those in CUSTOMER_PRICE_FIELDS, including the billing period) becomes a two-admin request, and the page says everything except the price was saved. Prices live in platform_retail_catalog_v2 — the only price a customer is charged.',
      },
      {
        // "Retire this price", "Put back on sale", "Remove for good" (Safe to remove)
        slug: 'admin-retire-a-product',
        title: 'How do I take a product off sale?',
        body: 'Retire this price takes it off sale; Put back on sale returns it. Remove for good is offered only when the row is safe to remove. Add-ons are ordinary rows in Prices.',
      },
      {
        // saveVendorRow → vendor_billing_catalog; vendor_plan_contents (approve_plan_contents_change)
        slug: 'admin-supplier-plan-prices',
        title: 'How do I change a supplier plan’s price or contents?',
        body: 'The same Prices browser edits supplier plans (vendor_billing_catalog). A plan’s contents need a second admin; its price currently saves with one — route it to a second admin yourself until that is gated.',
      },
      {
        // Catalogue › Market price bands "Recompute now" (recompute_market_price_bands → market_price_bands)
        slug: 'admin-market-price-bands',
        title: 'Why are market price bands empty, and how do I refresh them?',
        body: 'They are worked out from published supplier prices, and a group with too few prices is hidden — so empty is normal early on. Recompute now refreshes them.',
      },
      {
        // app/admin/hub-music/hub-music-manager.tsx "Add a track"; Songs "Master song catalogue" (Merge)
        slug: 'admin-music',
        title: 'How do I add Event Hub music or clean the song list?',
        body: 'Catalogue › Event Hub music › Add a track (M4A, MP3 or AAC); once published, couples find it in Look › Music. Catalogue › Songs is the master song catalogue: merge a duplicate into the one to keep, delete, or add to the list.',
      },
      {
        // Catalogue › Colours ("Reset to current"; platform_settings.app_colours, app_colours_edit)
        slug: 'admin-app-colours',
        title: 'How do I change the app’s colours?',
        body: 'Catalogue › Colours: edit and Save — Reset to current drops unsaved edits. It changes every screen except the guests’ Event Hub, and is logged. One admin.',
      },
      {
        // Catalogue ⚙ › Menus & icons (/admin/ugat?tab=menus; nav_slot_override; app/admin/menus/actions.ts)
        slug: 'admin-menus-and-icons',
        title: 'How do I rename a menu item or change its icon?',
        body: 'Catalogue ⚙ › Menus & icons: rename, change the icon, hide or reset any item. One admin, logged.',
      },
    ],
  },
  {
    key: 'admin-insights',
    label: 'Insights',
    audience: 'admin',
    articles: [
      {
        // /admin/app-performance tabs; old /admin/growth, /admin/funnels, /admin/insights redirect there
        slug: 'admin-sign-ups-and-funnels',
        title: 'Where are sign-ups and funnels?',
        body: 'Insights › Sign-ups & growth and Funnels — both pages of App performance; the old growth, funnels and insights addresses lead there. Intelligence holds churn, market pulse and lead scoring.',
      },
      {
        // Insights › Demand "Run now" (demand_radar_admin)
        slug: 'admin-demand',
        title: 'How do I refresh demand data?',
        body: 'Insights › Demand › Run now. Cells with too few data points are hidden on purpose.',
      },
      {
        // Insights › Problems, Slow loads, Browser blocks, Offline daemon
        slug: 'admin-errors-and-slow-pages',
        title: 'Where do I see errors and slow pages?',
        body: 'Insights › Problems, Slow loads, Browser blocks and Offline daemon.',
      },
      {
        // Insights › SEO & GEO "Re-run audit now"
        slug: 'admin-seo-audit',
        title: 'How do I re-run the SEO check?',
        body: 'Insights › SEO & GEO › Re-run audit now.',
      },
    ],
  },
  {
    key: 'admin-settings-and-keys',
    label: 'Switches, keys and the website',
    audience: 'admin',
    articles: [
      {
        // no single switch board: setBookingsOpen, receiving-account kill switch, setAiPaywall, setSampleEventSwitch; avatar › Switches (/admin/settings?tab=settings)
        slug: 'admin-flip-a-switch',
        title: 'How do I flip a platform switch?',
        body: 'There is no one switch board — each switch sits on its own page: opening and closing bookings in Money › Fees owed, each receiving account’s Turn on / Turn off in Money ⚙ › Receiving accounts (turning one off needs one admin; changing where money goes needs two), the AI paywall in Integrations, the sample event, and the app colours. Avatar › Switches holds the business details — name, TIN, address, VAT and the supplier contact for VALIDATE.',
      },
      {
        // app/admin/secrets ("Save key", "Mark rotated", "Redeploy production"); /admin/integrations
        slug: 'admin-rotate-a-key',
        title: 'How do I rotate a key or turn on an integration?',
        body: 'Avatar › Secrets & integrations: save the new key, Mark rotated, then Redeploy production — no key is ever shown back. Integrations holds email, AI, payments and sign-in providers.',
      },
      {
        // Catalogue › Website (/admin/studio?tab=website; is_enabled, order)
        slug: 'admin-homepage-blocks',
        title: 'How do I hide or reorder a homepage block?',
        body: 'Catalogue › Website: turn a block on or off and set its order.',
      },
    ],
  },
];
