## 2026-10-01 · feat(suppliers): Find a supplier by event type + a Messenger-style Chats inbox (P3)

Owner-approved design `prototypes/supplier_inbox_and_find_2026-10-01_fable.html`
(DECISION_LOG 2026-10-01 "SUPPLIER INBOX + FIND-A-SUPPLIER DESIGN — APPROVED, WITH
BOTH RECOMMENDATIONS").

- **Chats door.** A chat icon with the unread count sits beside ⋯ on the Suppliers
  header (`vendors/_components/chats-door.tsx`, a server component placed through
  a new `chatSlot` on `ServicesTakeover`). It opens the existing couple inbox
  `messages/`, restyled Messenger-like: avatar · supplier name · service · last
  line · time · unread dot · quiet Booked pill, newest first, one search on top;
  Archived and the start-by-email form fold below. The thread (One Chat Box) is
  untouched.
- **One unread rule** (`lib/couple-inbox.ts`) for the badge AND the list — the SQL
  rule of `unread_message_threads_by_event()` (a message from someone else newer
  than my last read, or never read). A refused read hides the badge; never "0".
- **Find a supplier** now opens `vendors/categories` (the old "Bring more
  categories on-stage" list, which walked the wedding ladder for every type and
  sent an inquiry on Add, is gone; `unlockCategoryWithInquiry` stays — onboarding
  uses it). One search · "Popular for <type>" (a wake: "What families usually
  need") · Venue & food · Look & style · Photos & video · Music & program ·
  Paperwork (a page-level map in `lib/supplier-find.ts`; DB tier names unchanged)
  · "Booked ✓" · a category → its suppliers (`searchCategoryVendors`, server-side)
  with ONE Filter ▾ (the shipped PickMenu: Serves your area · Lowest starting price
  first · 4★ and up) + Save to bench / Ask for a quote. The categories come ONLY
  from the bench's own scope (`buildShortlistFolders`), i.e.
  `service_categories.applicable_event_types`.
- **One `planGroupsForEventType`.** The copy in `lib/wedding-plan-groups.ts` (code
  `eventTypes` only) is gone; the DB-backed one in `lib/plan-groups-by-event-type.ts`
  now also applies that code floor. `lib/vendors-plan-budget.ts` honours it (new
  `planGroupScope` arg) — so the Suppliers plan list stops showing Bridal car /
  Rings / Honeymoon to a birthday and the wake's farewell cards to everyone. A
  group that already holds a pick always stays. `lib/upcoming-items.ts` reads the
  DB scope; `lib/event-costs.ts` keeps the code floor only (a filing list must not
  drop a category a cost may carry). A wedding's list is unchanged except that the
  three wake-only farewell cards no longer show to it (the existing
  "a wedding never sees a funeral section" rule).
- **Migration `20271257951866`** — birthday starter list (LED Wall gains
  `birthday`; the other 7 of the owner's 8 already had it) and a new tier-2 leaf
  **Chairs & tents** under Styling (`chair_table_rental` · `tent_canopy_rental` ·
  `event_lights_rental`), scoped wake · birthday · simple_event, pickable by
  suppliers. The 253 NULL rows in the decision row are SERVICES whose NULL means
  "inherit the tile"; they are deliberately not seeded (a copied list would
  override the tile and stop the owner's Scope-categories edits reaching them).
  Code registries follow (`taxonomy.ts`, icons, branch category, hints, booth
  template). Ugat J13 gains the scope columns + the parent FK.
- Guards: `lib/find-a-supplier-follows-the-event-type.test.ts`,
  `lib/suppliers-list-follows-the-event-type.test.ts`,
  `lib/chats-badge-equals-the-list.test.ts`,
  `tests/db/chairs-and-tents-is-a-real-leaf.db.test.ts` (each sabotaged once).

SPEC IMPACT: None.
