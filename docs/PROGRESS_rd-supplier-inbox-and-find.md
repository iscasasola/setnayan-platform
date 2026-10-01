# PROGRESS — rd/supplier-inbox-and-find (P3 · Supplier inbox + Find a supplier, step 4)

Stopped by the controller 2026-10-01 to move to a cloud session. WIP only — nothing typechecked,
built or tested. No PR opened.

## Done (committed here)

- `supabase/migrations/20271257951866_find_a_supplier_reads_the_event_type.sql` (allocated with
  `pnpm migration:new`) — birthday starter list (appends `birthday` to `led_wall`; the other 7 of the
  owner's 8 already had it) · new tier-2 leaf `chairs_tents` ("Chairs & tents") under `design`,
  scoped `wake · birthday · simple_event`, with 3 services (`chair_table_rental`,
  `tent_canopy_rental`, `event_lights_rental`) + `canonical_service_schemas` stubs · a DO-block guard
  (leaf under an active tier-1 parent, scope exact, ≥3 services, birthday list whole, and a temp-table
  snapshot proving no category stopped reaching a wedding). NOT replayed yet.
- `apps/web/lib/supplier-find.ts` — pure regroup of the bench's scoped folders into the host groups
  (The service · Venue & food · Look & style · Photos & video · Music & program · Paperwork/Prints &
  giveaways · Getting there & more), `Popular for <type>` / wake "What families usually need",
  Booked ✓ (null when the booked read failed), supplier count label. `FIND_GROUP_OF_TILE` is a
  `Record<WeddingTile, …>` so it will NOT compile until `chairs_tents` joins the `WeddingTile` union
  (deliberate). Leftover `void solemn;` line in `buildFindList` — delete it.

## Measured (replayed schema, 2026-10-01) — put in the PR body

- tier-2 tiles: 79, **77 scoped**; the 2 NULL are deliberate (`livestream` hidden-universal,
  `everything_else` hidden fallback).
- the "253" in the decision row = `canonical_service_taxonomy` rows with NULL — NULL there means
  INHERIT the tile (`getCoverageTaxonomy`, pinned by `tile-event-type-fillable.db.test.ts`). Seeding
  them would override the tile forever and break the owner's review in Admin › Scope categories
  (which writes the tile column only) — so they are deliberately NOT seeded. Say so in the PR.
- per-type visible tile counts: wedding 61 · gala_night 52 · debut 51 · corporate 47 · concert/
  open_house/grand_opening 46 · anniversary 42 · birthday/celebration 41 · graduation 40 · reunion 39 ·
  christening 36 · gender_reveal 27 · tournament 15 · travel 10 · wake 10 · date 6 · hangout 4 ·
  simple_event 0 (`event_type_profiles.marketplace_enabled = false` for simple_event).
- The audit's "Your Team shows Bridal car / Rings / Honeymoon to a birthday" is the PLAN accordion
  (`lib/vendors-plan-budget.ts` `orderedGroups = [...PLAN_GROUPS]`), NOT the bench — the bench
  (`buildShortlistFolders`) already filters by tile scope. Same loop also shows the wake's 3 farewell
  groups to every type today.

## Not done — the plan, in order

1. **Code registries for `chairs_tents`** (mirror commit 6e96c3cd6, `everything_else`): `lib/taxonomy.ts`
   (`WeddingTile` union, TILE_PARENT `design`, ORDER, LABEL "Chairs & tents", SLUG `chairs-tents`,
   TAXONOMY_MAP ×3 `{ folder:'design', tile:'chairs_tents', phase:'V1.2', rental:true }`),
   `lib/taxonomy-icons.ts` + `lib/vendor-service-tools.ts` (REUSE an icon already imported — shared
   bundle has ~18 B spare), `lib/vendor-branch-category.ts` (`chairs_tents: 'reception_decor'`),
   `lib/category-hints.ts`, `app/_components/plan3d/kit/booth-templates.ts`. Let tsc + the taxonomy
   guards name anything else.
2. **Collapse `planGroupsForEventType`**: delete the one in `lib/wedding-plan-groups.ts`; the DB-backed
   one in `lib/plan-groups-by-event-type.ts` takes `(eventType, scope = PLAN_GROUP_SCOPE_UNKNOWN,
   groups)` and ALSO keeps the code `eventTypes` floor (so a refused scope read never shows a funeral
   home to a wedding). Callers: `lib/upcoming-items.ts` (fetch scope there — it has a client),
   `lib/event-costs.ts` (default scope; a filing list must not drop a category a cost may carry),
   `lib/vendors-plan-budget.ts` (new arg `planGroupScope`; `orderedGroups` = in-scope groups PLUS any
   group that already holds a pick — a couple's pick never vanishes), vendors `page.tsx` passes
   `fetchPlanGroupScope(supabase)`; update `lib/a-wake-plans-its-own-farewell.test.ts` imports.
3. **Find page = extend the existing `app/dashboard/[eventId]/vendors/categories/page.tsx`** (route
   already exists, in `lib/routes.ts`; no new route — Vercel route budget). Server component:
   `buildShortlistFolders({ vendorRows: [], eventType, faithSet, taxonomy, eventId })` → `buildFindList`;
   counts `fetchVendorCountsByService(admin)` + `rollUpCountsToTile`; booked = `event_vendors`
   locked statuses → `tileForCategory`; `?q=` GET search; wake = solemn via `resolveProfileByEvent`
   (`register === 'solemn'`), also gate `marketplaceEnabled`. Category row → `?c=<tile>` view:
   `searchCategoryVendors({ eventId, ...benchSearchScopeForTile(tile), query })` called server-side;
   rows logo · name · area · from ₱ · rating; Filter ▾ = ONE `PickMenu` with `picked` (Serves your area ·
   Lowest price first · 4★ and up) in a tiny client file that `router.replace`s `?f=`; Save to bench =
   client button calling `saveVendorToPicks` (FormData `vendor_profile_id`, `event_id`, `tile`); Ask for a
   quote = `ContactShortlistVendorButton vendorProfileId label="Ask for a quote"`; booked → "Booked" +
   "Open chat ›". The old Unlock list + `UnlockCategoriesList` become unused (delete the component; KEEP
   `unlockCategoryWithInquiry`, onboarding uses it). Update `app/dashboard/reads-are-honest.test.ts`
   (two entries pin `picksMeasured ? (<UnlockCategoriesList`) to the new booked-read gate.
4. **Suppliers header chat icon + badge**: `ServicesTakeover` gets a `chatSlot` (server-rendered Link
   from `page.tsx`, beside `<TeamMoreMenu>`); "Find a supplier" becomes a Link to
   `routes…vendors.categories`; `TeamMoreMenu` always renders `SectionChips` (today replan-only) so the
   bench keeps a phone door. Update `vendors/your-team-phone-first.test.ts` (it pins the button's
   `goToSection('shortlist')`).
5. **Inbox restyle** `messages/page.tsx`: reuse `buildCoupleConversationRows` + `previewFor`
   (`lib/conversation-list.ts`) and `interestLabeller` like `messages/[threadId]/page.tsx` does;
   newest first; one GET search (`matchesSearch`); "N unread"; Booked pill (stage `booked`); keep
   Archived `<details>` + `startThreadByVendorEmail` (fold it to the bottom). Copy: "supplier", never
   "vendor" ("Open vendors" → "Find a supplier").
6. **One unread rule for badge AND list**: new `lib/couple-inbox.ts` reader mirroring the SQL rule of
   `unread_message_threads_by_event()` (a message from someone ELSE newer than my `last_read_at`, or
   never read) → `Set<threadId>` + `measured`; header count = that set's size over the same visible
   threads; badge hidden when unmeasured (`unreadBadgeLabel` in `lib/bench-unread.ts`).
7. Ugat: add claims to joint `J13` in `lib/ugat/graph.ts` — `service_categories.applicable_event_types`,
   `canonical_service_taxonomy.applicable_event_types`, fk `service_categories.parent_id →
   service_categories`. (P2 also edits graph.ts — expect a rebase.)
8. Tests (each sabotaged once): birthday Find lists no out-of-scope tile; wedding-only tiles hidden for a
   birthday; wedding list unchanged (db: replay `only` < 20271257951866 vs full, wedding tile set equal);
   header badge == list unread count (render both from one fixture); `chairs_tents` resolves to an active
   tier-1 parent (db).
9. Changelog fragment `changelog.d/rd-supplier-inbox-and-find.md` (SPEC IMPACT: None). Then the CHECKS +
   PR ROUTINE from the prompt; bundle (≤206,848 B) + action budget (1225 now, must stay 1225) before/after.

## Gotchas found

- Worktree-isolation refuses shell variables in paths and `cd` to computed paths — use literal paths.
- The shared scratchpad `specs/` and `specs-p4/` clones are broken/empty; clone your own
  (`--depth 1 --filter=blob:none --no-checkout` + sparse `/*.md` and the prototype) or it hangs.
- No bundle "before" number was captured (the build was stopped). Get it from a clean origin/main build
  under the heavy lock, or from main's `bundle size check` CI job log.
- Three unread rules exist today (notifications per thread for bench badges; `chat_thread_reads` in the
  thread page's column, which also counts your OWN last message; the SQL RPCs). Pick the SQL rule for
  the new badge + list and say so.
- Server-action budget is at 1225/1225 — every action above is reused, none added.
