## 2026-07-01 · perf(account-switcher): drop the switcher's dead queries + dedupe the fetch

The AccountSwitcher panel opens instantly (it's a pre-rendered client toggle
over a `data` prop), but `getSwitcherData()` is awaited inside every dashboard
layout's top-level `Promise.all` — so the whole chrome (and the page under it)
blocked on it on every cross-doorway navigation and hard load. This trims that
fetch to only what the panel actually renders.

**What was dead weight (removed from `get-switcher-data.ts`):**

- **`gallery`** — a per-event Papic photo count. The events-first switcher
  redesign (owner 2026-06-22) removed the gallery section from the UI but left
  this fetch behind; confirmed zero consumers app-wide. PR #2542 had just swapped
  its underlying full-row scan for a grouped-COUNT RPC
  (`current_user_gallery_counts`) — a good fix to a query that shouldn't run at
  all. Removing the whole thing supersedes that: an optimized count is still
  wasted work when nothing renders it. The RPC is now unused by the switcher and
  can be dropped in a later migration.
- **`favorites`** — a `vendor_favorites` → `vendor_profiles` join, likewise
  removed from the UI in the same redesign, likewise unused. Deleted.
- The `SwitcherGallery` / `SwitcherFavorite` types and the `gallery` / `favorites`
  fields on `SwitcherData` (and the four layouts' `minimalSwitcherFallback`
  literals) go with them.

**Dedupe:** `getSwitcherData` is now wrapped in React `cache()` (keyed by
`userId`). The Library page's `photos-albums` loader also calls it in the same
request; without the cache that render paid for TWO identical fetches. Now one.

Net: the switcher fetch drops from 3 serial round-trips (batch → events →
gallery counts) to a single parallel batch (`users` + roles + `event_members`)
followed by one bounded `events` read, with the photo presign overlapped. The
panel stays fully server-rendered, so it keeps its instant-open property (no
skeleton, no fetch-on-click). Mobile bottom sheet and desktop side drawer both
benefit — they share this one data layer. No UI or behavior change.

SPEC IMPACT: None. Internal perf only — no schema, no route, no pricing, no
user-facing surface change. The switcher UI already dropped its gallery/favorites
sections (owner 2026-06-22); this only removes the now-orphaned server queries
behind them and memoizes the fetch. (Corpus DECISION_LOG append deferred — this
worktree is isolated from the shared spec corpus and parallel sessions edit it
concurrently; this fragment carries the full record.)
