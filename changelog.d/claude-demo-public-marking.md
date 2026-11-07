## 2026-11-06 · feat(demo): demo shops and demo events show publicly as "(DEMO ONLY)" — and a real event can never book one

PR (a) of the demo-catalogue plan (`plans/demo-catalogue-2026-11-06/PLAN.md` § 6(a), specs repo). Owner rulings:
DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS", "DEMO CATALOGUE — scope", "Demo catalogue — owner clicks" — they
supersede the 2026-09-29 `is_demo` hide rule and the same-day "keep demo shops hidden" / "Sample shop" clicks.

- **Public, marked.** Demo shops (`vendor_profiles.is_demo`, still listed + verified) and demo events
  (`events.is_sample`) show beside real ones: Explore (cards, folders, compare), the shop page `/v/[slug]`
  (`shopPageGate`) and its share image, service cards, the front page shelf and search, check-a-date, the shop's
  own website card, the demo event page and its story. Every one wears ONE marker, `DemoOnlyMarker`
  (`app/_components/sample-marker.tsx`, PR #7333's chip) with the owner's words **"(DEMO ONLY)"**. Demo stays
  `noindex`, out of the sitemaps and out of `/api/v1`. `LIVE_SHOP_GATE` drops `is_demo`; `REAL_SHOP_GATE` keeps it.
  `/suppliers` landing pages keep excluding demo (indexed + print counts).
- **Never booked.** `lib/demo-scope.ts`: an event and a shop meet only when `events.is_sample = vendor_profiles.is_demo`.
  14 write paths refuse with "This is a demo shop — it can't be booked." (link/book, save to picks, lock, deposit,
  change order, inquiry, start thread, negotiation lock, quote send/create, onboarding shortlist). Database backstop:
  migration `20271316355263_a_real_event_never_books_a_demo_shop.sql` — `refuse_demo_cross_booking()` BEFORE
  INSERT/UPDATE trigger on `event_vendors`, `chat_threads`, `vendor_proposals`, `orders`, `booking_fee_charges`,
  `vendor_contracts`, `vendor_payment_asks` (only when the pairing changes, so legacy rows keep their lifecycle).
- **Own search scoped.** A real event's supplier search (category, bench, wizard, same-day, date selection, venue,
  onboarding) never shows a demo shop; a demo event sees only demo shops. The admin demo cookie no longer reaches
  inside an event; it only forces demo shops' prices public.
- **Demo never counts.** Admin KPIs, growth stats, spotlight awards, readiness, funnels, Explore's trending count and
  badge percentiles, the front page's shop count, and in SQL `recompute_market_price_bands`,
  `recompute_market_funnel_bands`, `refresh_demand_radar_rollups`, `admin_market_analytics`.
- **Retired:** `scripts/check-no-demo-in-prod.mjs` and the `DEMO_MODE_CLEANUP_DEADLINE` Dec-1 banner (they would fail
  against the ruling). Replaced by `scripts/check-no-demo-cross-booking.mjs` (read-only prod audit of rule 3).
- **Guards:** `demo-shops-wear-the-marker` · `a-real-event-never-finds-a-demo-shop` · `a-real-event-never-books-a-demo-shop`
  (+ `.db.test.ts`) · `demo-never-counts` · `demo-scope`.

SPEC IMPACT: The controller recorded the ruling (DECISION_LOG 2026-11-06 rows above); no further corpus edit.
