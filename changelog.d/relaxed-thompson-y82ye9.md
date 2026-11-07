## 2026-11-06 · feat(memories): R3 — the Thank-You Video maker moves into Memories; `/studio/thank-you` forwards

The event-menu reorganisation's step R3 (`EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` steps 9 + 14). Memories' keepsake
row already had a Thank You button, but its door still opened `/studio/thank-you` — the maker had never moved.

- The page moved WHOLE (git mv, no redraw) to `/dashboard/<id>/memories/thank-you`. One address, `thankYouVideoHref`
  (`lib/memories-keepsakes.ts`), is asked by the catalogue (`addOnHref('thank-you')` — the keepsake row's sheet and
  Home's Papic card read it), Home's App row and the sign-in return.
- The old address forwards in the middleware (`lib/legacy-redirects.ts`, 308, no route spent) — owner 2026-10-28
  *"all mapping will be kept"*.
- The Memories tab lights the page (`STUDIO_ABSORBED['thank-you']` → memories); its back goes to Memories.
- The app answers as before at the new address: refused without Apple's shop (`WEB_ONLY_FEATURE_ROUTE`), opened where
  Apple sells (`IAP_OPENED_ROUTE`; `isStoreShellHiddenAddon` also reads a key's Memories home).
- Guard `lib/r3-thank-you-forwards.test.ts` (5 tests, each sabotaged red). Tests that named the old file path re-pointed.

SPEC IMPACT: `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 9 (R3) + step 14 (`/studio/thank-you`) marked BUILT
(draft PR) in the corpus; no decision changed.
