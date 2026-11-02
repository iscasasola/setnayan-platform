## 2026-10-09 · chore(guests): the Guest list loses its dead code

The live Guest list is `guests/page.tsx` → `_components/guests-screen.tsx` (Maker PR 4f). The retired roster, `GuestListMultiselect` (2,276 lines), was still in the tree — mounted only by the dev lab's `?part=rows` — and three live files imported two exports and a context from it. This removes it so the next builder adapts only what is live.

- **Moved, unchanged (cut and paste):** `ROLE_SECTION_ORDER` → `_components/role-section-order.ts` (the unused `mobileCols` field of its config stayed behind); `NewGroupInlineForm` → `_components/new-group-inline-form.tsx`; `GuestListHasSidesContext` → `_components/guest-list-has-sides-context.ts`. `page.tsx` and `guests-screen.tsx` re-pointed.
- **Deleted:** `guest-list-multiselect.tsx`, `chip-editors.tsx`, `seat-chip.tsx`, `guest-checkin-cell.tsx`, `guest-access-cell.tsx`, `plus-one-seats-note.tsx`, and the three modules only they imported (`phone-column-channel.ts`, `row-tap.ts`, `use-roster-columns.ts`), plus `DeleteGuestButton` (its only caller was the +1 note). `live-search.tsx` is NOT dead (the top bar's guest search imports it) and stays.
- **`/dev/guests-lab`** keeps its route and every part that mounts a live component; only `?part=rows` (the dead roster) is gone and redirects to `?part=screen`.
- **Tests** that pinned only the dead roster/chips were deleted with it; tests that pin a claim still true of the live screen were re-pointed at `guests-screen.tsx` / `page.tsx`; tests that mixed both were trimmed to the live half. Hand-kept bills updated: `no-door-out-of-the-app` (the roster Contact `tel:` bill is now empty), `gold-is-not-text`, `role-names-reach-every-screen`, `selectors-are-pills-that-slide`, `the-name-style-reaches-every-formal-surface`, `no-surface-invents-a-bride` (its ungated backlog is now empty).
- **Generated files regenerated:** `port-control-baseline.json` (`pnpm port:baseline`), `no-card.baseline.txt`, `lib/ugat/screens.generated.json`.

SPEC IMPACT: None
