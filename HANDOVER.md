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
