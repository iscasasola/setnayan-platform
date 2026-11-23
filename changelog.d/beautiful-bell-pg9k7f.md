## 2026-11-23 · feat(hub tools): five shared hub tools work on the supplier's live Hub page

The first five of the ten most-shared unbuilt hub tools (DECISION_LOG 2026-11-23; free under the tool rule): **Queue counter · Entourage · Paperwork checklist · Load-in & venue access · Delivery & drop-off**. Each one uses a shipped template. None has a screen of its own. All five are now `shipped: true` in `lib/hub-tools.ts`.

- **Checklists (Paperwork · Load-in · Delivery)** reuse the shot list:
  - its rows in `event_shot_list_items`, now with a `tool_key` column;
  - its actions, which take an optional `tool` argument;
  - its component, which takes a `tool` prop.

  Each checklist has its own title, its own starting list, its own device copy and its own rows. The couple's supplier workspace shows each saved checklist beside the shot list.
- **Queue counter** (the counter template): each "Served" press saves one timed row, and "Take one back" removes the latest one. The count is the number of rows, shown as "served of coming". "Coming" is the RSVP's attending number from the brief. A refused read says "couldn't load" and never shows 0.
- **Entourage** (the per-person sheet): the couple's own entourage from the march's loader (`loadMarch` → `entourageSheet`), one row per person with their role. It is read-only, and a refused read is shown as refused.
- **Switches:** the five are day-of modules that any shop may switch on (Hub › Set up › Tools for this event).
  - They start ON when Admin › Categories › Hub tools suggests them for a booked category (`readHubToolSuggestions` → `suggestedHubTools`). A suggestion is never a gate.
  - A tool admin turned off leaves every Hub.
- **Migration `20271361191665_hub_tool_lists_ride_the_shot_list.sql`:** `event_shot_list_items.tool_key` (FK `hub_tools`, default `shot_list`, insert-only). RLS is unchanged.
- **Lab:** `/dev/supplier-set-two-day-lab?s=hub-tools` (every control works on sample data) and `?s=hub-tools-unread`.
- **Guards:**
  - `lib/the-five-hub-tools-work.test.ts` (one sabotage red);
  - `tests/db/shot-list-items.db.test.ts` (+2 cases).
- Server actions: no new export.

SPEC IMPACT: None. It builds the 2026-11-23 ruling as written, and every tool uses its ruled template. The owner's "wait first" correction row of the same day was flagged to the controller, who sent this build.
