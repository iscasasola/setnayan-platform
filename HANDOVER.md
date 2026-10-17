# HANDOVER — rd/two-hosts-round-2 · started 2026-10-18 ~07:40 PHT by the controller

Round 1 = PR #6626 (LIVE 4509889): shared pattern "merge from base" — apps/web/lib/merge-from-base.ts (+ lib/hub-draft-rebase.ts,
lib/guest-card-merge.ts, updateHubDraft in lib/hub-draft-store.ts, event_site_drafts.revision compare-and-set), the one-line
Maker note "Changed on another screen a moment ago — showing the newest." Read #6626's PR body + its tests first.
Owner approved today's list ("all builds for today"); this finishes the same item.

FIX, in #6626's ranked order, with THE SAME pattern (no new one), one commit each + test + sabotage:
 1. Maker scene canvas panels still sending no base: element-sheet, hero design, cover-* (server already accepts a base).
 2. Event Details form.
 3. saveReceptionDesign.
 4. Seating floor plan / booths / signs.
 5. print_details (6 writers).
 6. Post Event saveEditorial.
 7. renameRole / extra_roles.
 8. style_preferences · setDelegateArea · schedule answers and nudges · E-Gifts method edit · live widget config / wizard_state.
 9. useBlockLooksDraft (a Maker draft save the follow-ups builder handed to this lane).
Stop after what fits cleanly; name the rest as left in the PR body. Keep the Maker first-load budget (never raise it).
Migrations only via pnpm migration:new; Ugat/exposure guards green. Never open the owner's cale-ice Maker.
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/ (use your OWN walk folder, e.g. scratchpad/two-hosts-2-walk/ —
another builder's serve.sh in a shared folder killed a server today). Changelog fragment changelog.d/rd-two-hosts-round-2.md.

## Progress (builder, 2026-10-18)
- [x] 1. Canvas panels: one shared base map `sendCanvasBase`/`forgetCanvasSent` in lib/maker-draft-store.ts (part-look's map moved there);
      element-sheet · maker-hero-design · cover-animate · cover-lines · cover-words-background wired. Tests lib/two-hosts-every-writer-sends-its-base.test.ts 1a–1c;
      sabotage S1–S4 each red, restored green. Round-1 guard 12 re-pointed (part-look now calls sendCanvasBase).
      LEFT (not in the list): part-words · type-in-place · details-bound-field · scene-background-row · main-background-panel · post-event-scene-panel · editor-shell canvas writes.
- [x] 2. Event Details form: lib/event-details-merge.ts (row shape, like guest-card-merge); details-form posts its base, updateEventMatchCriteria
      writes only changed fields (region/feel now absent⇒untouched for a based post; names and birth data go as groups; a based no-change save writes nothing).
      Tests 2a–2c; sabotage S5–S8 red→restored. LEFT: the open form does not redraw the other host's values (it shows them next open).
- [x] 3. saveReceptionDesign: new shared server half lib/update-json-column.ts (`updateJsonColumn`: compare-and-set on the jsonb VALUE, rebuild
      on a lost round, a refusal said at once). Editor sends base (defaults laid in), server mergeFromBase + CAS, editor shows merged + the note.
      Tests 3a–3c + tests/db/two-hosts-every-writer-sends-its-base.db.test.ts (3); sabotage S9–S12 red→restored. Prod sizes measured
      (largest jsonb on the target columns: style_preferences 763 chars; editorial draft_json 4965 > the 3000 compare cap).
- [ ] 4. Seating floor plan/booths/signs — LEFT (whole-row upsert of ~30 columns + replace-all lists; its own PR).
- [x] 5. print_details: lib/print-details-write.ts `updatePrintDetails(admin, eventId, change)` on updateJsonColumn; all 7 writers
      (route name-style · poster clear · poster set · menu · words; saveInviteMessage; Apply) pass a CHANGE on the blob as it is now.
      5 guards re-pointed to the same property in the new shape (name-style AST guard now: no direct serialize + every change spreads its arg).
      Tests 5a–5b; sabotage S13–S15 red→restored.
