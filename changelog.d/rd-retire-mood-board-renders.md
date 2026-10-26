## 2026-10-26 · chore(mood-board): retire "Make it real" renders — delete the feature, take the pack off sale

Owner, verbatim: *"mood board render is no longer available. can we delete that? there is no more button for this"*.

Measured first (prod, read-only): 0 orders and 0 App Store purchases for `MOODBOARD_RENDER_PACK` ever, 0 renders,
0 credit spends. The only rows are one free consent-bonus credit and one withdrawn share consent, both on the
owner's own event.

Where it was still reachable: couples no longer saw it (their Mood Board opens in the Maker, which never mounted
it), but the standalone `/dashboard/<id>/studio/mood-board` page — kept for coordinators/planners and event types
with no Event Hub — still mounted the section, its jump link, the "Browse shared renders" door on every
inspiration slot, and (with Apple's gate on) the App Store pack sheet. `/admin/moodboard-renders` was live too.

- **Deleted:** `make-it-real.tsx`, `render-pool-picker.tsx`, `render-actions.ts`, `fetchRenderPool` /
  `applyRenderPick`, `/admin/moodboard-renders` (+ its nav row), `lib/gemini-image.ts`,
  `lib/moodboard-make-it-real.ts`, `lib/moodboard-render-{credits,failure,gallery,pool,prompt,keys,serve}.ts`,
  `lib/moodboard-gallery-copy.ts` and every test that only tested them.
- **Money:** the pack's grant hook and refund reversal in `lib/sku-activation.ts`; the App Store product
  `com.setnayan.app.mood_board_renders_50` (the `mood-board-pack` kind and `moodBoardRendersMatch` with it); the
  `/dev/iap-doors-lab` door; the `formatV2Sku` entry. `BUILD_STATUS.MOODBOARD_RENDER_PACK` → `'not_built'` (retired).
- **Catalogue:** migration `20271289025011_retire_mood_board_render_pack` sets `is_active = false` (row kept).
- **Copy:** /features/mood-board is plain `free` (no render claims, no price code); the concept PDF no longer says
  "Use Make it real…"; the privacy page no longer lists the Gemini image model; the Maker's Mood Board navigator
  lists no "Make it real" part.
- **Kept on purpose:** the render tables and RPCs (two tables hold rows — dropping them is an owner call), their db
  tests, the RA 10173 export/erasure of those rows, the `renders/` private-bucket routing rule, and
  `lib/moodboard-render-parts.ts` (now the part vocabulary for supplier sign-offs and the 3D Plan locks; its
  credit pricing removed). The Ugat node says RETIRED and still maps the real schema.
- **Guard:** `lib/mood-board-renders-are-retired.test.ts` — no product sells the pack, no app/lib code calls a render
  RPC / writes render credits / names the SKU (positive control: `lib/v2-catalog.ts`), the latest migration
  switches it off, no navigator part. Sabotaged twice, red each time.
- Regenerated: admin map + jobs, Ugat screens, port-control baseline (only the removed render controls), dark
  label-contrast record (one pair from the deleted file).

🍎 Owner action, App Store Connect: remove "Mood Board · 50 renders" from build 6's submission / Remove from Sale
(25 products need screenshots, not 26), and drop "Mood Board render packs" from the App Review reply.

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-26 "MOOD BOARD RENDERS ("MAKE IT REAL") ARE RETIRED" (Setnayan-specs
23dae39e) — supersedes the Mood Board pack in the 2026-10-23 five-more-Apple-products row.
