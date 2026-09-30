## 2026-09-30 · fix(train): midnight train — one retired word, and two guards brought up to the folded tree

Merge train for the 2026-09-30 RSVP & Invitation release.

- **The one copy fix (#6202):** the Add-from-your-people sheet said "…your beloved, and your samahan." — a retired feature name on screen (`lib/retired-names-stay-off-screen.test.ts`). It now reads "…your beloved, and your group."
- **#6198 × #6191:** #6198 pinned the guest table's section and self-join `colSpan`s at `hasSides ? 9 : 8` / `hasSides ? 7 : 6`. #6191 then added an Access column beside Role on every event, so the table now has 10 header cells with Side and 9 without. The spans are `hasSides ? 10 : 9` / `hasSides ? 8 : 7`, and `a-simple-event-has-no-sides.test.ts` now pins those.
- **#6202 × #6197:** the camera mount now sits inside its tab's `group('live', papicGuest ? (…))`. `the-maker-canvas-draws-no-camera.test.ts` accepts that wrapper. The gate is still `papicGuest ? (`.
- **Conflicts resolved in the fold, both intents kept:** the "signing out erases your selfie" line (#6195) now lives inside the shared `signOut` element (#6197), so it shows on the Me tab too. The guest table keeps `hasSides` (#6198) and uses the new access props (#6191).

SPEC IMPACT: None
