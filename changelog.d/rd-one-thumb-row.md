## 2026-10-22 · feat(nav): one thumb row — Find's row is the template; the signed-in top bar loses its search

- New `apps/web/components/thumb-row.tsx` (`<ThumbRow name left field right action>`) — the Couple › Suppliers (Find)
  row lifted into one component: no band, each control its own `.sn-glass-row` glass, 44 px rounds, one order
  (⇕ ☑ · field · ≡ · the one terracotta main verb last). `components/thumb-dock.tsx` docks it on the bottom dock
  below 1024 px and makes it the content column's first line from 1024 px.
- Find draws through it; its placeholder is "Search suppliers" (the old "Search all suppliers or add your own" was cut
  at 375). Guests (List · Map) draws through it — "Search guests", ☑ Select folded into the ≡ menu (owner Q1),
  ＋ Add always shown; the Select mode keeps its pills for now.
- Events gets "Search events" · ＋ Create event; Discover gets "Search events, people, suppliers" alone in its row.
  Enter goes where the palette's step-out row goes (`marketplaceEscapeItem`), so it follows #6782 into the shell.
- The signed-in top bar carries no search (shells hand `search={false}`); the app shell no longer builds the
  palette's index on every request. Signed out is unchanged.
- The top-bar palette retires with it: `home-command-bar.tsx`, the top bar's guest search (`guests-top-search.tsx`,
  `live-search.tsx`) and the `InsideEventContext` only they read are deleted (`ugat-both-ends`: a component nothing
  mounts is deleted, not baselined). `HomeCommandItem` moves to `frontdoor/command-item.ts`; the index and its results
  page are unchanged. Guards on the retired palette are re-aimed at the thumb rows that took its job.
- Guard: `lib/every-thumb-row-is-the-one-row.test.ts`.

SPEC IMPACT: DECISION_LOG row "ONE THUMB ROW" (owner 2026-10-22, "Yes to all") — prototype
`prototypes/one_thumb_row_2026-10-22.html` is the contract.
