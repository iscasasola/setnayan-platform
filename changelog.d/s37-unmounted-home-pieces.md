## 2026-09-18 · chore(home): delete 13 components nothing mounts — the leftovers of two replaced homes (S37)

**SPEC IMPACT:** None — deletes code already unreachable; no screen changes.

S26's both-ends guard (#5625) ranked these `component-no-mount`. Each was re-measured
(`git grep` for the export and the file name) and each is **(b) delete the end nobody
needs**, because the design that mounted it was replaced on the owner's instruction:

| file | why it stopped being mounted |
|---|---|
| `(launcher)/_components/home-board.tsx`, `alaala-tile.tsx`, `alaala-wall.tsx`, `alaala-lenses.tsx`, `creator-benefits.tsx` | the account home became "Your events" (owner 2026-08-19, `the-home-is-your-events.md`); every destination they carried was audited reachable then |
| `(launcher)/_components/expandable.tsx`, `account-inline.tsx` | the 2026-07-13 expand-in-place home, replaced by the 2026-07-15 remodel |
| `(launcher)/_components/shop-logo.tsx` | imported by the launcher but never rendered; its only other user was `creator-benefits` |
| `(account)/_components/life-flash-home-card.tsx` | the Life-Flash home card, dropped by the 2026-07-15 remodel; Life-Flash is reached from Alaala |
| `create-event/_components/event-type-carousel.tsx` | its only mount, `EventSwitcher`, went in the 2026-07-12 hygiene sweep (`8bdf1f63d`) |
| `app/_components/home/setnayan-ai-story.tsx` | the cinematic homepage was retired 2026-08-13 (`fd35918e8`) |
| `app/_components/dashboard-placeholder.tsx` | May-2026 scaffold; every route that used it got a real page |
| `studio/_components/service-poster.tsx` | the Studio hub was rebuilt 2026-06-14; the `PosterStyle` type it still exported moved into `lib/add-ons-catalog.ts`, its only reader |

**Guards — none weakened; each assertion about a deleted file went with the file:**
- `alaala-is-memories`: dropped the tile/wall/lens-list assertions; the "memory wall is
  mounted" check is narrowed to `<AlaalaLensBody>` on Alaala's own page (the stronger form).
- `unmeasured-is-not-zero`: the `buildHomeBoardTiles` half went with `home-board`; the two
  assertions on the launcher's own admin-total derivation stay.
- `lib/alaala-tile-counts-memories.test.ts` deleted — its only subject was the board tile.
- `reads-are-honest`: the `creator-benefits` bill line removed (the guard's stale check requires it).
- `port-control-baseline.json` regenerated; the removed lines are the deleted files' controls.

⏭ **Not done here, named:** the launcher still BUILDS `spaces` / `samahanRows` (with the
"Couldn't check the queues" state) and never renders them — the named debt in `page.tsx`.
