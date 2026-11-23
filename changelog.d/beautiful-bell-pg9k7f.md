## 2026-11-23 · feat(hub tools): five shared hub tools work on the supplier's live Hub page — in the ONE home

The first five of the ten most-shared unbuilt hub tools (DECISION_LOG 2026-11-23; free under the tool rule): **Queue counter · Entourage · Paperwork checklist · Load-in & venue access · Delivery & drop-off**. Each one uses a shipped template, and none has a screen of its own. All five are now `shipped: true` in `lib/hub-tools.ts`.

**One home (controller ruling, DECISION_LOG 23 Nov).** Every row these tools keep lives in `vendor_hub_tool_entries`, the table from #8211 (Hub tools B), which this branch carries. Rows are read by its ONE reader, `readHubToolEntries`, and written by its ONE action, `hubToolEntry`. The five are drawn by the same `HubToolPanels` that draws B's five.

- **Checklists (Paperwork · Load-in · Delivery)** are rows on the Checklist template, each with its own words and mark.
- **Queue counter** is a row on the Counter template. The count is the row's `qty`, measured against the RSVP's coming guests from the brief. If the guest count can't be read, it is never shown as 0.
- **Entourage** keeps no rows. It shows the couple's own entourage from the march's loader (`loadMarch` → `entourageSheet`), read-only, and a refused read is said. `READ_ONLY_TOOLS` makes the one writer refuse it, and refuse Dietary & allergies, whose answers come from the RSVPs.
- **The Shot list is untouched.** Its rows, its reader and the couple's workspace card are exactly as on `main`. `event_shot_list_items` gets no `tool_key`, and the couple reads none of the new tools' rows.
- **Switches:** the five are day-of modules that any shop may switch on (Hub › Set up › Tools for this event).
  - They start ON when Admin › Categories › Hub tools suggests them for a booked category (`readHubToolSuggestions` → `suggestedHubTools`). The same applies to B's five. A suggestion is never a gate.
  - A tool admin turned off leaves every Hub.
- **No migration of its own.** The earlier `20271361191665_hub_tool_lists_ride_the_shot_list.sql` is deleted.
- **Lab:** `/dev/supplier-set-two-day-lab?s=hub-tools` (the shipped view on sample data; every press runs the dispatcher's own decision) and `?s=hub-tools-unread`.
- **Guards:**
  - `lib/the-five-hub-tools-work.test.ts`;
  - new `lib/no-hub-tool-borrows-the-shot-list.test.ts`, a source scan of `app/` and `lib/`: only the Shot list's own code names `event_shot_list_items`, and that code names no other hub tool and no `tool_key` (sabotage-checked red).
- **Server actions:** no new export.

SPEC IMPACT: None. It builds the 2026-11-23 ruling and the controller's one-home ruling of the same day as written.
