## 2026-11-23 · feat(shop): the Shop remaster and the Store (tools · graphs · badges)

Built from Fable's drawing `prototypes/supplier_store_graphs_badges_2026-11-23/` (v10), owner-approved, rulings DECISION_LOG 2026-11-23 (specs 5a8c6bf3 → 46690f6d).

- **Shop, in the drawing's order:**
  - Cover: a Storage row (bar, "12 GB of 128 GB" from the plan's `TIER_CAPS` and `readStoredBytes`; "Couldn't load", never 0), with the plan as a small chip that opens the storage sheet. Then one line: View shop · Share · Promote. The five-tile quick row is gone. Promote is one sheet with two tabs, Posters & prints (the shipped Promote body: Prints · Gifts · Share your work) and QR codes. Old `?sheet=prints|qr` links still land.
  - Analytics: the graphs the shop picked, in its order, then an "Add a graph" tile into the Store. Never picked = every open graph, as before.
  - Badges: the three the shop follows (else the three closest), each with what is left and the next step, "See all" (the new Badges page) and "Follow another" (the Store).
  - Your tools: the free tools added and the paid ones held (bought · with the plan · on the trial), then "Add a tool". It replaces the Specialized tools carousel. `?tool=<key>` opens a tool, and `?added=tool:<key>` marks it New.
  - Templates: Chat forms · Card forms · Offer maker · Payment plan ("N saved"). Each opens what it opened before.
  - Services: the list ends in an "Add a service" tile. The thumb row's ＋ is gone (the head keeps its ＋).
- **Store** (`/vendor-dashboard/shop/store`, a shelf, an item):
  - Three shelves (Specialized Tools · Graphs · Badges), with search at the thumb and Show & sort behind Sliders.
  - A tool item shows its one-time price from the catalog (or "Price not set yet"), "Try it first" (the Cake Maker's demo), what it adds, and one button: Open · Get · Buy.
  - Graphs: "On your Analytics · drag to arrange" (✕ takes one off), then the groups. A badge-locked graph names its badge and what is left.
  - Badges: up to three followed. They are earned, never sold.
- **Badges page** (`/vendor-dashboard/shop/badges`): every badge with its ring, the seven-step ladder, what is left, and the next gift (Verified's Papic gift once).
- **Money:**
  - Four tools are sold ONCE and owned forever: Cake Maker · Song bank · Papic challenge · 3D plan. Each is one `vendor_billing_catalog` row (`vendor_tool_<key>`), and the price is read from the row.
  - Buying is apply-then-pay through the one `storeAction` (no new server-action export; `suggested-coverage-actions.ts` folded two exports into one to make room).
  - A 30-day trial of the tools starts at a shop's first Verified. An event booked inside the trial keeps its tools to its last day.
  - The Cake Maker gates (save, open, couple's send, chat ＋) now ask `readShopCakeToolOpen`: the plan OR bought OR the trial. Papic challenge and the 3D plan gates ask the same in SQL.
- **Migration `20271360126307_supplier_store_tools_graphs_badges.sql`:**
  - 4 catalog rows.
  - `vendor_specialized_tools_access.store_trial_ends_at`, backfilled for shops already verified, plus a stamp-once trigger on Verified.
  - `vendor_store_tool_open` (service role).
  - `vendor_papic_challenge_entitled` and `event_branded_booth_vendor_ids` now honour it.
  - `vendor_profiles.store_graphs / store_badges / store_tools` (per-column grants; `vendor_profiles_self` rebuilt).
- **Guards:**
  - `lib/supplier-store.test.ts`.
  - `shop/store/the-store-is-the-drawing.test.ts`.
  - `shop/the-cover-is-the-store-drawing.test.ts` (re-aims `the-quick-row-is-the-drawn-five`).
  - 12 Shop guards re-aimed to the new order.
  - Both money rosters list the Store's buy.

SPEC IMPACT: None. This builds the 2026-11-23 rulings as drawn. The storage sheet leaves out the drawing's "photos at each event, by plan" list: those limits have no home in the catalog or `TIER_CAPS` yet (raised as an owner question on the PR).
