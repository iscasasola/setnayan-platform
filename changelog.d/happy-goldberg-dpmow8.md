## 2026-11-23 · feat(hub tools): Tech rider · Personalisation list · Dietary & allergies · Quantity vs guests · Set list

The second five of the ten most-shared unbuilt hub tools (DECISION_LOG 2026-11-23 "THE TEN MOST-SHARED UNBUILT HUB TOOLS", free). Each is a tool record in `lib/hub-tools.ts` (now `shipped: true`), drawn on the supplier's live on-the-day screen by its template from the approved drawing (`prototypes/hub_tools_working_2026-10-28/`).

- **Switched on per booking with the existing day-of modules** (`lib/vendor-dayof-modules.ts`, the Hub's per-event switches). Every supplier can turn any of them on.
  - On by default: Tech rider and Set list for performers; Quantity vs guests for serving shops; Dietary & allergies for the food folder; Personalisation list for prints and gifts.
  - They're drawn inline (`dayOfModuleHref` → null), so the Event Hub's supplier desk never links to them.
- **① Checklist: Tech rider.** Tick, add, edit, and swipe to remove with Undo.
- **② Per-person: Personalisation list.** A name, what to write or engrave, and a done tick.
- **② Per-person, read-only: Dietary & allergies.** Shows the coming guests' own RSVP answers (meal pick + dietary note, + table once guests may see seats). It is for a supplier booked for food only (catering · cake · mobile bar), per DECISION_LOG 2026-10-28 "shown to the booked caterer only". Anyone else is told who the list is for. The supplier never types health data.
- **④ Counter: Quantity vs guests.** Labelled counters with ＋/−, written once the presses settle. Each reads against the page's one headcount read (the brief's `pax.attending`). An unread headcount draws no bar and no "of 0".
- **⑤ Ordered list: Set list.** Song Desk's own sets (`SetsPanel`), reused and opened, with new ▲ ▼ to order songs. It steps aside when the Song Desk is the person's desk tonight.
- **Migration `20271360665147_hub_tool_entries_and_dietary_list.sql`:**
  - `vendor_hub_tool_entries`: one table for every Checklist, Per-person and Counter tool, keyed by `tool_key`. RLS is the shot list's pattern: the booked supplier's own rows, admin read. Column grants keep event, supplier and tool insert-only.
  - `vendor_event_dietary_list(event)`: SECURITY DEFINER, food-booked only. Anon has no EXECUTE.
- **One writer, no new route.**
  - `hubToolEntry` (add · edit · tick · count · remove) is the dispatcher; its decision is `parseHubToolEntryOp` (tested).
  - The slot is paid for by folding `removeSongFromVendorEventSet` into `updateVendorEventSet`, which also takes `moveSong`. Server actions stay at 1251.
- **Honest reads:** each tool shows "We couldn't load …" with Try again in its place. `fetchVendorEventSets` gains an additive `failed` flag.
- **Words:** the old "Setlist" door to the repertoire now reads "Song bank" (where it goes), so two rows never both say Set list.
- **Lab:** `/dev/supplier-hub-tools-lab` has every tool and state on sample data, with an in-memory saver that runs the dispatcher's own decision.
- **Guards:**
  - `lib/hub-tool-entries.test.ts`: 17 tests, one sabotage shown red.
  - `tests/db/hub-tool-entries.db.test.ts`: 9 tests (RLS, column grants, the caterer-only gate, attending-only and no "No preference").

SPEC IMPACT: None. These are approved seed tools built on their approved templates. One reading is the builder's, flagged in the PR for the owner: "caterer only" is read as the food categories the seed gives the tool to (catering · cake · mobile bar).
