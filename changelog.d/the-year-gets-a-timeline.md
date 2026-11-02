## 2026-09-02 · feat(clusters): the cluster learns its own timeline

Item 7c, on top of 7a's linking primitive (`20271189765490`) and 7b's shared
person spine (`20271191258098`). Both of those were schema with no screen by
design; this is the phase the owner's 2026-09-02 ruling calls the expensive
half — **the planning surface**. A group of linked celebrations now has a page.

- New migration `20271192016913_the_cluster_learns_its_own_timeline.sql` adds
  `public.cluster_timeline(p_event_cluster_id UUID)` — one row per celebration
  in a cluster, chronological. `SECURITY INVOKER`, mirroring
  `cluster_guest_roster()`: no elevated rights, inherits the existing RLS on
  `event_cluster_members` (owner-or-couple) and `events`, so no ninth pattern
  is invented and a stranger or a mere guest reads zero rows. Revoked from
  PUBLIC/anon; EXECUTE granted to `authenticated` + `service_role`.
- 🪤 **`events.event_date` is not a date.** For `year`/`month` precision it
  holds a first-of-range **placeholder** (`'2027-01-01'`), so `ORDER BY
  event_date` sorts "Sometime in 2027" as if the host had said New Year's Day
  — ahead of a wedding genuinely booked for January, opening the year with the
  one celebration nobody has scheduled. Measured 2026-08-20 and recorded in
  `lib/join-door-meta.ts`: 4 of 9 prod events carry `year` precision while
  holding a real-looking date, so this is the common case, not the edge case.
  Instead each row resolves to the **range its own precision claims** (a
  multi-day `event_end_date` extends the tail) and is ordered by that range's
  **midpoint**. Undated celebrations sort last, not first.
- ⚠ `sort_key` is a **sort key, never a label** — rendering it would invent a
  July date the host never chose. The human label reuses the app's existing
  `formatEventDateWithPrecision()` rather than reimplementing it.
- ⛔ **Nothing is stored.** No `year`/`season`/`starts_on`/`ends_on` column; 7a
  forbids it in advance ("a stored span goes stale the first time a date
  moves"). The span is derived on every read by `clusterSpan()`, at month
  granularity because the endpoints come from rows of mixed precision.
- New server actions (`app/dashboard/(account)/clusters/actions.ts`): create,
  rename, link, set/clear anchor, unlink. Until now **no row could ever be
  created in production** — 7a shipped both tables with no door. They are thin
  wrappers over 7a's policies on the ordinary cookie-scoped client, never
  `createAdminClient`; a refused write under RLS changes nothing rather than
  throwing, so each one `.select()`s and checks the returned length.
  Setting the anchor is two statements because the partial unique index
  permits only one anchored row per cluster.
- New screens at `/dashboard/clusters` and `/dashboard/clusters/[clusterId]`.
  🔑 **Not `/dashboard/year`** — that route is taken and deliberately retired
  (owner 2026-08-21), redirects to `/dashboard#worth-planning`, and was about
  the *calendar*, an unrelated meaning of the same word.
- Reads follow the `measured` convention from `lib/guests.ts`: a refused read
  returns `measured: false` meaning **we do not know**, and the pages say so
  instead of rendering an empty year — the defect this repo has already fixed
  seven times.
- ⛔ **No money on the surface**, per the owner's ruling that a cluster is
  presentation and planning and never accounting. Budgets are 7d.
  `a-pot-belongs-to-one-celebration.db.test.ts` runs unmodified and green.
- New guards: `tests/db/the-year-knows-when-each-celebration-is.db.test.ts`
  (ordering with a year-precision member, multi-day tail, undated-last, RLS
  parity for a stranger and for a non-couple guest, no stored span) and
  `lib/the-span-is-derived-and-the-sort-key-is-never-shown.test.ts`. Both
  mutation-proved: the naive `ORDER BY event_date` turns the ordering test red,
  `SECURITY DEFINER` turns three disclosure tests red, and rendering
  `sort_key` turns the source scan red — all restored.
- `supabase/security/exposure-surface.baseline.txt` regenerated: exactly one
  added line, `cluster_timeline` as `secdef=no exec=authenticated`.

Verified locally: `tsc` exit 0 · `next lint` exit 0 · 11,846 unit tests green ·
40 DB-replay assertions green across the Ugat map, the pot guard and all three
cluster suites · production build exit 0 · 18 repo guard scripts pass.

SPEC IMPACT: `WHATS_NEXT_Papic_Build_Order_2026-08-29.md` § 7 marked 7c built
(only 7d remains), and a `DECISION_LOG.md` row recorded for the two calls made
here rather than inherited — the route name, and ordering by range midpoint.
