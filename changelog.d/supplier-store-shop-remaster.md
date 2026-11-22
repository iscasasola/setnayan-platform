## 2026-11-23 · feat(shop): the Shop remaster and the Store (tools · graphs · badges)

Built from Fable's drawing `prototypes/supplier_store_graphs_badges_2026-11-23/` (v12: v10 + the Edit frames + tool tags), owner-approved, rulings DECISION_LOG 2026-11-23 (specs 5a8c6bf3 → 46690f6d, 060467d5, 14827167).

- **Shop, in the drawing's order:**
  - Cover: a Storage row (bar, "12 GB of 128 GB" from the plan's `TIER_CAPS` and `readStoredBytes`; "Couldn't load", never 0), with the plan as a small chip that opens the storage sheet. Then one line: View shop · Share · Promote. The five-tile quick row is gone. Promote is one sheet with two tabs, Posters & prints (the shipped Promote body: Prints · Gifts · Share your work) and QR codes. Old `?sheet=prints|qr` links still land.
  - Analytics: the graphs the shop picked, in its order, then an "Add a graph" tile into the Store. Never picked = every open graph, as before.
  - Badges: the badges the shop chose, any number, in its order (never chosen = the three closest), each with what is left and the next step, "See all" (the new Badges page) and "Add a badge" (the Store).
  - Your tools: the tools in the shop's order — free ones added, paid ones held (bought · with the plan · on the trial) — then "Add a tool". It replaces the Specialized tools carousel. `?tool=<key>` opens a tool, and `?added=tool:<key>` marks it New.
  - Each of the three rows has a count beside its name and an **Edit**: one shared sheet ("Arrange Analytics" · "Arrange Badges" · "Arrange your tools") to drag into order and (−) take one off; Done saves. Taking a paid tool off the page keeps it owned. The section order stays fixed.
  - Templates: Chat forms · Card forms · Offer maker · Payment plan ("N saved"). Each opens what it opened before.
  - Services: the list ends in an "Add a service" tile. The thumb row's ＋ is gone (the head keeps its ＋).
- **Store** (`/vendor-dashboard/shop/store`, a shelf, an item):
  - Three shelves (Specialized Tools · Graphs · Badges), with search at the thumb and Show & sort behind Sliders.
  - Every tool shows the supplier types it is for (Cake Maker → Cake; Scanner → Every service), read only from the per-category hub-tools table (`HUB_TOOLS_SEED` + an admin's saved switches) and `suggestedFor`'s rules — no category is typed. The Tools shelf opens with tag chips (All · For you · each supplier group), then For you · Yours · More tools. Tags only order and suggest: every shop can still get every tool.
  - A tool item shows its one-time price from the catalog (or "Price not set yet"), "Try it first" (the Cake Maker's demo), what it adds, and one button: Open · Get · Buy.
  - Graphs: "On your Analytics" (✓ On your page), then the groups with Get. A badge-locked graph names its badge and what is left.
  - Badges: "On your Shop" (✓ On your page) and "More badges" (Add). They are earned, never sold.
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
  - ONE column for the Shop's three rows: `vendor_profiles.store_layout` jsonb `{graphs, badges, tools, tools_off}` (object, ≤ 8 KB; SELECT to the shop, none to anon; `vendor_profiles_self` rebuilt). Written only by `storeAction` op `layout` — add, remove and reorder are all that one write.
- **Screens and lab:**
  - The Store pages read once, then hand their facts to `store/_components/store-screens.tsx`. The Badges page hands its facts to `shop/_components/badges-list.tsx`.
  - `store/_components/graph-art.tsx`: the graph sketch, shared by the Store and the Edit sheet.
  - The supplier lab mounts the same screens on fixtures: `/dev/supplier-lab?s=store|store-tools|store-cake|store-graphs|store-graph|store-badges|badges-page`.
  - `?s=shop-tab` now shows the new order and the storage row.
- **Guards:**
  - `lib/supplier-store.test.ts` (now also: one layout column + one op; tags from the table only, never a gate).
  - `shop/store/the-store-is-the-drawing.test.ts`.
  - `shop/the-cover-is-the-store-drawing.test.ts` (re-aims `the-quick-row-is-the-drawn-five`).
  - 12 Shop guards re-aimed to the new order.
  - Both money rosters list the Store's buy.

SPEC IMPACT: None. This builds the 2026-11-23 rulings as drawn. The storage sheet leaves out the drawing's "photos at each event, by plan" list: those limits have no home in the catalog or `TIER_CAPS` yet (raised as an owner question on the PR).
