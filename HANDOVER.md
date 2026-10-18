# HANDOVER — rd/two-hosts-round-3 · started 2026-10-18 ~12:40 PHT by the controller

Rounds 1–2 LIVE (#6626, #6629): "merge from base" (lib/merge-from-base.ts, lib/update-json-column.ts, event_site_drafts.revision,
the one-line note). Read both PR bodies + tests first. Owner today: "build it" (round 3) and, on the two open questions,
"do your recommendation". The controller's recommendation, now the ruling:
 A. The note NAMES the person: "Claire changed this a moment ago — showing the newest." (their first name as the event
    shows it; "Someone" only if unknown). Needs a small who-made-this-step record on the draft's steps/saves.
 B. ↺ undoes only YOUR OWN steps — it skips the other host's steps; if none of the steps are yours, ↺ is greyed.
    Same who-made-it record. Reset/Restore are unchanged.
ROUND 3 WRITERS (same pattern, one commit each + test + sabotage): seating floor plan / booths / signs · Post Event
saveEditorial (its value is ~5k chars — over the compare limit, so use a revision counter or per-key merge) · schedule
answers and nudges · E-Gifts method edit · live widget config_json · wizard_state · the seven other Maker canvas writers
#6629 named. Keep the Maker first-load budget (it has ~0.2 KB left — make room, never raise it).
Migrations via pnpm migration:new; Ugat/exposure guards green. Never open the owner's cale-ice Maker.
Another builder is editing the Maker's own-section scene + ◆ marks + the gifts accent (rd/maker-own-section-photos) —
don't touch those parts; one is changing sign-in (rd/google-login-same). Own walk folder (scratchpad/two-hosts-3-walk/).
Shots of the named note + greyed ↺ at 375 → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-two-hosts-round-3.md.

## BUILDER LOG (round 3)
- [x] Step 1 · A + B: `by` on every draft state (`HubDraftState.by`, set via `updateHubDraft(…, build(cur, by), …, author)` →
  `mergeHubDraft(…, by)`); `lib/hub-draft-authors.ts` (undoOwnHubDraftStep, hubDraftStepAuthorOf, twoScreensNoteFor,
  pickHostFirstName); `lib/host-first-name.server.ts`; summary canUndo = own steps (`hubDraftCanUndoOwn`); ↺ reason
  "Nothing of yours to undo". Test `lib/two-hosts-name-and-own-undo.test.ts` (9). 5 guards re-aimed.
  Decision: a step with no recorded author (pre-existing drafts, admin-client writers) stays undoable by anyone — greying
  it would strand every existing draft. Live-column writers (no who-record) keep the neutral "another screen" line.
- [x] Step 2 · host answers + e-gift edit (`lib/host-answers-merge.ts`, `lib/egift-method-merge.ts`).
- [x] Step 3 · seating floor/booths/signs (`lib/floor-plan-row.ts`, `lib/floor-items-merge.ts`; editor + 3D lab send base).
- [x] Step 4 · Post Event `saveEditorial` (buildDraft for input+baseInput, only changed keys onto a fresh re-read).
- [x] Step 5 · live widget config_json (`lib/widget-config-write.ts`, CAS on updated_at) + Apply's section write + STD
  venue card + wizard palette slot (`updateJsonColumn`). wizard_state LEFT (SELECT-denied column, no events version col;
  prod value `{}` everywhere per #6629).
- [x] Step 6 · Maker writers: part-words, type-in-place, details-bound, scene-background-row (multi), post-event panel,
  editor-shell saveCanvasWith, use-scene-canvas→shared map; rebase learns `custom` + `editorial`. Main background NOT
  merged (its kinds share no fields — a pick there is whole) — decided, in PR body.
- [x] Step 7 · lab `?as=` hosts. Fragment written.
- [ ] Step 8 · open draft PR, CI, walk shots (named note + greyed ↺, 375), sabotage runs, bundle.
