## 2026-11-23 · feat(toolkit): Toolkit v19, part 2 (the v19 shelves, QR designs, Your widgets, the shipped Event Hub widgets)

Built from Fable's drawing `prototypes/supplier_store_graphs_badges_2026-11-23/` (v19), owner-approved. Owner ruling via the controller, "Yes, include them": the shipped hub tools and finished features join the Toolkit. Controller GO, 23 Nov: one array feeds both the shelves and `toolkitCounts`; each item once; the Papic camera only while `isVendorPapicCaptureEnabled()`; empty Forms shelves hidden; graphs read from `CARD_ORDER`; Scanner stays one item.

- **The one Toolkit list.** `toolkitItems` in `lib/supplier-store.ts` holds every widget (`listedWidgets`), the four QR designs (`PROMOTE_QR_MODES`), every graph (`CARD_ORDER`) and the badge tiles, each once. The shelves (`shelfItems`, `visibleShelves`) and the live count (`toolkitCounts`, now widgets · QR designs · graphs · badges) both read it. The Toolkit masthead, each item page and /for-suppliers show the same count.
- **Seven shipped Event Hub widgets** join `SPECIALIZED_TOOLS`, all free. Each opens where it already lives; nothing was re-coded:
  - Shot list and Issues log open On the day (the day-of console).
  - Production sheet, Hand over to the couple and Seat plan open on a booked client's page.
  - Live reviews opens on the day screen.
  - The Papic camera is listed only while its privacy switch is on (fail closed).
  - Each widget has its icon and a "How to use it" guide written from its shipped screen.
- **The v19 shelves:** Chat widgets · Present widgets · Event Hub widgets · Shop page widgets · QR designs · Graphs · Badges. Each widget names its shelves.
  - The three Forms shelves (Chat forms · Card forms · Payment plans) have no ready-made form on main, so they are hidden. No sample items.
- **Toolkit front:**
  - Chips: All · Widgets · QR designs · Graphs · Badges. A kind with nothing gets no chip.
  - An **Installed** switch (the shared `SwitchTrack`).
  - A **Your widgets** door.
  - Featured cards: a "New · Recommended" graph not yet installed, and "For your services", a paid widget suggested for the shop. A card shows only when a real item fits.
  - Every visible shelf, with See all.
- **Your widgets** (`/shop/store/yours`): every installed widget as a card showing where it is used, with Open · How to use it · Remove (a built-in has no Remove). It has place chips.
- **QR designs** (`/shop/store/qr`, `/shop/store/qr/<code>`):
  - My page is built in. Check a date, Shortlist and Reviews are installed until removed.
  - Removing one only takes it off Promote's list: `QrCodes` takes `hide`, and Promote reads the layout. A refused read hides nothing.
  - The layout gains a `qrs` row in the same `store_layout` jsonb, written by the one `storeAction` op=layout. No migration.
  - The QR words moved to `lib/supplier-qr-codes.ts` (`SUPPLIER_QR_WORDS`) so the rows and the Toolkit read one copy.
- **Item page:** a strip (Price · Works in · For) and an Information table (Price · Renewal · Suggested for, plus Status for an installed, owned-and-removed or off-plan widget). Where it works covers the new doors.
- **Shop cover:** View shop · **Toolkit** · Share · Promote (v19 frame 0).
- **HUB_TOOL_LIBRARY:** `shot_list`, `incident_log` and `tables_and_seating` now read `shipped: true`. A guard fails if a shipped Event Hub widget's hub tool is ever flagged unshipped again.
- **/for-suppliers:** "On the day, in every plan" lists every free, ungated widget. The Song bank (paid) and the Papic camera (gated) are no longer claimed for every plan.
- **The card gate (DECISION_LOG 3a2419fd, owner via the controller, 23 Nov: "only show tools they can use based on the services they have online").** It supersedes the 28 Oct "never a gate" ruling for the Toolkit.
  - One new read, the shop's ONLINE cards (`vendor_services.category` where `is_active`). The join is the code taxonomy's tile: a card kind's tile (`TAXONOMY_MAP`) meets the tile of the widget's tag categories (`toolTags`, the seed plus an admin's switches).
  - Not served and never installed or bought → hidden, and left out of the dashboard Toolkit count.
  - Installed, bought or in review → shown greyed (`no_card`): "Turn on a <category> card to use it.", with a Your services door. Still installed and still owned; no refund, no uninstall.
  - Back online → it works again by itself (computed on every read).
  - The grey shows on the Toolkit front, shelves and item page, on Your widgets, and on the Shop's Your widgets row (its panel says the line in place of the tool).
  - The buy action refuses a widget no card serves.
  - Always shown (shop-level): Scanner, Production sheet, Live reviews, Hand over to the couple, graphs, badges, QR designs, and any widget tagged with a seed category no card kind maps to yet.
  - A failed card read hides and greys nothing, and says "Couldn't check your service cards".
  - /for-suppliers stays the whole catalogue. On the day and the client pages are not greyed.
  - The Admin › Categories hub-tools words now say the switches also decide the Toolkit.
- Server actions stay at 1251 (everything folds into `storeAction`).

Not drawn: the drawing's QR print designs (sample names) and its item "Pictures" (there are no real pictures yet; the clip slot stays empty until recorded).

SPEC IMPACT: Builds DECISION_LOG 3a2419fd (the card gate; already in the corpus) and keeps 1b9ebf78 (price bands: the four `vendor_tool_<key>` values change in #8193's migration, not here; no migration in this PR). No new ruling.
