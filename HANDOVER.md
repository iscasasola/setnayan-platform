# HANDOVER — rd/look-restudy-6-9 · started 2026-10-18 ~16:20 PHT by the controller

Owner 2026-10-18 list item 8 (approved-not-built: the Look restudy) + "Continue as it becomes available". Ship-on-green
authorised through 19 Oct. CONTRACT: corpus BACKGROUND_RESTUDY_2026-10-08_fable.md (approved DL 2026-10-08 "restudy is
good") + its amendments in DECISION_LOG (read via `git -C ~/Documents/Claude/Projects/Setnayan show origin/main:<path>`).
Rows 1, 2, 4 MERGED (#6426, #6431, #6427); row 3 delivered by other PRs (site_roles migration, Elements › Fonts four rows);
row 5 music mostly shipped (verify the music_starts button).
BUILD the NOT-STARTED rows, exactly as the doc draws them, one commit each:
 6. Cover follows Main + retire the Save-the-Date film background (a migration via pnpm migration:new — applied only by
    the pipeline; carry existing values, nobody loses a chosen background).
 7. Part background "Same as main".
 8. Background Effects block (Motion / Blur / Overlay row) — distinct from the 8 text/picture effects (#6601/#6607).
 9. Magic Move → Logo Animate (MagicMovePick leaves Look).
Open owner question in the DL — where "Our music" songs come from — is NOT part of this PR; don't touch music sources.
Pro ◆ rules: all Animate/effects/Style are Pro (#6623 pattern: tried free, named at ✓ Apply). Keep the Maker first-load
budget (≈0.2 KB left — lazy-load; never raise it). Saves go through the merge-from-base door (#6626/#6629/#6632) — call it,
don't rewrite it. Other builders in the Maker: own-section photos (#6634), Logo maker L2–L4 (#6638 — coordinate row 9:
touch only the Look side's MagicMovePick; if #6638 owns Logo Animate code, wait for it to merge and say so).
Files: launch/_components/studio-*, website/editor/_components/main-background-panel.tsx, pro-panels.tsx, hub-draft.
375 px shots light + dark + side-by-side vs the doc. Never open the owner's cale-ice. Own walk folder
(scratchpad/look-rest-walk/). Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-look-restudy-6-9.md.

## STATE — builder (Opus 5.5), 2026-10-18
- Row 9 DONE (240288514b): cover Logo › Animate › Action "Travels to the bar ◆" writes site_magic_traveller via the draft; MagicMovePick gone; 4 guards re-aimed; port baseline regenerated.
- Row 6 DONE (7bffb6b51f): film wears main background (mainGroundStillFor/stdFilmOnMain); STD picker removed; migration 20271277600211 (30-day copy std_background_retired, service-role only). Prod measured read-only: 2 events, both already have a main → nothing moves.
- Row 7: shipped in substance by the 2026-10-09 toolbar (Maker_Two_Bars_LOCKED: Source ▾ first choice "The Event Hub's" = Same as main, picking it = back to main). Gap vs the lock: the part's Source lacks Video ◆ — next.
- Row 8: next — Effects block "The picture": Parallax ◆ switch + Blur ▾ inside BgEffects, greyed with reason on Colour; widen parallax to loops/clips.
- 17:40 PHT: four rows built; merged origin/main twice (latest with #6638/#6634); CI round 1 reds fixed locally (4 guards re-aimed, STD hero read bound, stage golden updated for the 2 film cases). PR #6639 draft, do-not-auto-merge. Next: watch CI round 2; fix reds; delete this file when fully green. Shots: ~/Documents/Claude/Projects/shots-2026-10-18/6639/. Hard stop 19:45 PHT.
