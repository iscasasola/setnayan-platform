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
