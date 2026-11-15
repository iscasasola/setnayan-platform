## 2026-11-15 · feat(badges): J5 — each badge's Bronze opens its own graphs; shops that saw graphs keep them

Owner, 15 Nov: every supplier badge prototype is approved and the build may start (DECISION_LOG 7d6c8129). The contract is `prototypes/supplier_badges_2026-11-15/badge-unlock_v6.html`.

- **Which graphs each Bronze opens** (`lib/graph-unlocks.ts`, the ruled table):
  - Completed bookings → slow months · lost dates · who brings you couples.
  - Five-star reviews → what couples say · replies that book.
  - Gifts given → **Gifts given → bookings** (new, last in the carousel, marked New).
  - Trusted by opens nothing yet. Its old partners graph no longer fits now that it counts returning clients (50566f42, open item 10).
  - Invites opens nothing yet: unruled (open item 4).
  - The sign-up, Verified and Pro graphs are unchanged.
- **An unearned graph is never drawn, not even greyed.** One plain line under the carousel names what that badge opens and how many are left to go.
- **Keep what you had:**
  - A shop Verified when this ships keeps every graph it saw (the `vendor_graph_unlocks_kept` marker). The new gifts graph still waits for its badge.
  - A Bronze once earned (a `shop_badge_rewards` step) keeps its graphs if a count later dips.
- **Honest reads:** a count that could not be read never counts as 0. The graphs stay shown and nobody is told they are below Bronze. A badge this build has no counter for (five-star reviews and gift points are J0's, #7753) is decided by the steps already earned.
- **Gifts graph:** couples who asked, split by offered-a-gift × booked. Its recommendation fires only with couples still deciding and gift stock in hand, and is High impact when gifted couples book at least twice as often.
- **Migration** `20271348267938` (adds only):
  - the keep marker, RLS on at create, no client writes, backfilled once for the shops Verified at apply time;
  - `shop_graph_unlock_facts`: kept · trusted-by · earned steps, in one call;
  - `shop_gifts_to_bookings`: the booked statuses are passed in from `BOOKED_EVENT_VENDOR_STATUSES`, never typed twice.
  - Both functions are service_role only.
- **Constraints met:** no new server action, no new route.
- **Guards** (every claim was broken on purpose and went red):
  - `tests/db/graphs-open-at-bronze.db.test.ts`
  - `lib/graph-unlocks.test.ts`
  - `app/vendor-dashboard/performance/graphs-open-at-bronze.test.ts`

SPEC IMPACT: None — builds the approved badge-unlock_v6. Gaps named in the PR:
- Trusted by graphs (open item 10) and Invites graphs (open item 4).
- The full-screen unlock flow (badge → what it opened → tour → summary, Later resumes) rides J0's notice and `shop_award_flow_progress`.
