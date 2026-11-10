## 2026-11-10 · feat(supplier-today): step 5's saved paper swipes left to Remove, with Undo (Build 5 item T)

Build 5 item T asked for #7369 (Today steps 5 + 6: paper rows, the shop QR at `/v/`, the first-visit tour) "rebuilt on
main". Measured first: **#7369's work is already on main** — it rode in with #7399 (the ONE supplier build, merged
2026-11-08; commits `c2d70fa79f` · `37f860922d` · `95dad30ba6` · `2ea5138112`), wired on the live Today
(`vendor-dashboard/page.tsx` → `SupplierSetupScreen` → `SetupPapers` / `SetupQrStep`, `readTourSeen`), held by
`the-papers-and-the-qr-hold.test.ts` (8) and `setup-is-done-in-place.test.ts` (6, incl. the six steps in order). So
nothing was rebuilt; this is the one delta left against the approved v21 `docRow` and house template T14:

- A paper with a file is the one `SwipeToDelete`: swipe left → **Remove**, with the house Undo toast
  (`deleteWithUndo`). The Remove inside the opened preview is the same remove — no longer an at-once `save('')` with
  no way back.
- The row reads as empty ("Add") at once; the empty ref is written through the same queued `updateDocUploadInline`
  only after the Undo window. A file picked inside the window writes the waiting remove first (`flush`), so a late
  remove can never wipe the new copy.
- `SetupPapers` mounts the one `UndoToastHost`.

Guard: `apps/web/app/vendor-dashboard/_components/a-saved-paper-removes-by-swipe.test.ts` (5; three sabotages seen red).

SPEC IMPACT: None — implements the approved v21 `docRow` swipe and house template T14 as already ruled.
