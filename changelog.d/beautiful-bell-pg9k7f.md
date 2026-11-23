## 2026-11-23 · feat(hub tools): five shared hub tools work on the supplier's live Hub page — in the ONE home

The first five of the ten most-shared unbuilt hub tools (DECISION_LOG 2026-11-23; free under the tool rule): **Queue counter · Entourage · Paperwork checklist · Load-in & venue access · Delivery & drop-off**. Each one uses a shipped template, and none has a screen of its own. All five are now `shipped: true` in `lib/hub-tools.ts`.

**One home (controller ruling, DECISION_LOG 23 Nov).** Every row these tools keep lives in `vendor_hub_tool_entries`, the table from #8211 (Hub tools B), which this branch carries. Rows are read by its ONE reader, `readHubToolEntries`, and written by its ONE action, `hubToolEntry`. The five are drawn by the same `HubToolPanels` that draws B's five.

- **Checklists (Paperwork · Load-in · Delivery)** are rows on the Checklist template, each with its own words and mark.
- **Queue counter** is a row on the Counter template. The count is the row's `qty`, measured against the RSVP's coming guests from the brief. If the guest count can't be read, it is never shown as 0.
- **Entourage** keeps no rows. It shows the couple's own entourage from the march's loader (`loadMarch` → `entourageSheet`), read-only, and a refused read is said. `READ_ONLY_TOOLS` makes the one writer refuse it, and refuse Dietary & allergies, whose answers come from the RSVPs.
- **The Shot list is untouched.** Its rows, its reader and its couple workspace card are exactly as on `main`. `event_shot_list_items` gets no `tool_key`.
- **👀 Couples see the checklist ticks** (owner, 23 Nov: *"let couples see the checklist ticks"*). This uses the route the one-home ruling named: a per-tool flag on `hub_tools`, never a second table.
  - **Migration `20271361284618_couples_see_supplier_checklist_ticks.sql`:**
    - adds `hub_tools.couple_sees` (default off), switched ON for the `checklist` template only: Paperwork · Load-in · Delivery · Tech rider · Ceremony details · Proofs · Safety permit;
    - adds a read-only policy, `vendor_hub_tool_entries_couple_read`, for the event's hosts only. It uses `current_couple_event_ids()`, never `current_event_ids()`, which also returns guests. The policy reads the flag and `is_active` live.
  - **Couple workspace:** the supplier's page shows each saved checklist under the Shot list (`SupplierChecklistsCard`), read by the one reader `readCoupleChecklists`. Which tools show is decided by the library flag, never a list in code. A refused read says so, and a supplier with no lists draws nothing.
  - Counts, the Personalisation list, Quantity vs guests and Dietary & allergies stay supplier-only.
  - Lab: `?s=couple-checklists` and `?s=couple-checklists-unread`.
  - DB proof (`tests/db/hub-tool-entries.db.test.ts`, 14 of 14):
    - the couple reads the ticked Tech rider row and not the count;
    - a guest of the same event, another supplier and a stranger read nothing;
    - the couple cannot insert, tick or delete;
    - turning the flag off hides the rows.
    - Sabotage: swapping in `current_event_ids()` turns the guest test red.
- **Switches:** the five are day-of modules that any shop may switch on (Hub › Set up › Tools for this event).
  - They start ON when Admin › Categories › Hub tools suggests them for a booked category (`readHubToolSuggestions` → `suggestedHubTools`). The same applies to B's five. A suggestion is never a gate.
  - A tool admin turned off leaves every Hub.
- **No migration of its own.** The earlier `20271361191665_hub_tool_lists_ride_the_shot_list.sql` is deleted.
- **Lab:** `/dev/supplier-set-two-day-lab?s=hub-tools` (the shipped view on sample data; every press runs the dispatcher's own decision) and `?s=hub-tools-unread`.
- **Guards:**
  - `lib/the-five-hub-tools-work.test.ts`;
  - new `lib/no-hub-tool-borrows-the-shot-list.test.ts`, a source scan of `app/` and `lib/`: only the Shot list's own code names `event_shot_list_items`, and that code names no other hub tool and no `tool_key` (sabotage-checked red).
- **Server actions:** no new export.

SPEC IMPACT: Changes point (3) of the controller's one-home ruling (23 Nov), "the couple reads none of these rows for now". On the owner's word, the couple now reads every checklist-template tool, through the per-tool flag that ruling named. The DECISION_LOG row is for the controller to add; this session has read-only access to the specs repo.
