## 2026-10-18 · fix(two-hosts): round 3 — the note names the person, ↺ takes back only your own steps, and the last writers merge from their base

Round 3 of #6626 / #6629 (owner 2026-10-18: "build it"; on #6626's two questions, "do your recommendation"). Same
pattern — **merge from base** (`apps/web/lib/merge-from-base.ts`).

- **Ruling A — the note names the person.** Every Maker draft state now records who made it (`HubDraftState.by`, set by
  the one door: `updateHubDraft` hands the author to `mergeHubDraft(…, by)`). A save that met another host's change says
  "Claire changed this a moment ago — showing the newest." (`lib/hub-draft-authors.ts`, the name from
  `lib/host-first-name.server.ts`: their guest row on this event, then their profile); your own other phone keeps
  "Changed on another screen…"; a step nobody is recorded for says "Someone".
- **Ruling B — ↺ takes back only YOUR steps** (`undoOwnHubDraftStep`): the other host's later steps stay (and stay
  theirs to take back); a value they changed after your step keeps their value. With none of yours left ↺ is greyed
  ("Nothing of yours to undo"). Reset and Restore unchanged. Steps from before this record stay undoable by anyone.
- **Writers:** seating floor plan (only changed columns, `lib/floor-plan-row.ts`) · booths and signs (a row this screen
  never saw is never deleted, `lib/floor-items-merge.ts`) · Post Event `saveEditorial` (only the story keys this screen
  changed, laid onto the row as it is when the write lands) · schedule host answers (`lib/host-answers-merge.ts`) ·
  E-Gifts method edit (`lib/egift-method-merge.ts`) · live section `config_json` writers + Apply's section write + the
  Save the Date venue card (`lib/widget-config-write.ts`, one write at a time on `updated_at`) · the mood-board palette
  slot (`updateJsonColumn`) · the Maker writers #6629 left (part words, type-in-place, the Details-bound field, a scene's
  background incl. Every scene, the Post Event scene panel and part sheet, a scene's tabs now on the shared map); the
  draft door also merges a scene's own words (`custom`) and the story's keys (`editorial`).
- **Lab:** `/dev/maker-lab?as=indalecio|claire` — a tab is one of two hosts, so both rulings can be walked.

SPEC IMPACT: None — rulings A and B were decided by the owner in the session (2026-10-18) on #6626's open questions; no
corpus document described the old behaviour as locked.
