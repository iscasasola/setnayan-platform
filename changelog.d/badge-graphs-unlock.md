## 2026-11-15 · feat(badges): J5 — each badge's Bronze opens its own graphs; shops that saw graphs keep them

Owner, 15 Nov: every supplier badge prototype is approved and the build may start (DECISION_LOG 7d6c8129). The contract is `prototypes/supplier_badges_2026-11-15/badge-unlock_v6.html`.

- **Which graphs each Bronze opens** (`lib/graph-unlocks.ts`, the ruled table):
  - Completed bookings → slow months · lost dates · who brings you couples.
  - Five-star reviews → what couples say · replies that book.
  - Gifts given → **Gifts given → bookings** (new, last in the carousel, marked New).
  - Trusted by opens nothing yet. Its old partners graph no longer fits now that it counts returning clients (50566f42, open item 10).
  - Invites → **Suppliers you invited**: ONE graph, month by month (invited · booked · completed an event; specs 7fbff0cd (10)). An imported supplier counts only once its event is completed. ⏸ **Not counted yet:** nothing records which shop imported which supplier until the add-a-supplier door is built (owner 6439 (4)). So the badge's line says "not counted yet" and the graph is never drawn; its read lands with that door.
  - The sign-up, Verified and Pro graphs are unchanged.
- **An unearned graph is never drawn, not even greyed.** One plain line under the carousel, in the drawing's words (badge-unlock_v6 `.more`).
- **Keep what you had:**
  - A shop Verified when this ships keeps every graph it saw (the `vendor_graph_unlocks_kept` marker). The new gifts graph still waits for its badge.
  - A Bronze once earned (a `shop_badge_rewards` step) keeps its graphs if a count later dips.
- **Honest reads:** a count that could not be read never counts as 0. The graphs stay shown and nobody is told they are below Bronze. Every count is main's own counter; a badge not counted yet (`BADGE_REWARDS.measured`) keeps its graph waiting.
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
- Trusted by graphs (open item 10).
- The Invites graph's data: it needs a record of who imported whom, which the add-a-supplier door creates (and that door needs a server action — none allowed here).
- The full-screen unlock flow (badge → what it opened → tour → summary, Later resumes) rides J0's notice and `shop_award_flow_progress`.

## 2026-11-17 · fix(badges): J5 audit fixes — main's steps and counters, the drawing's words

- **Bronze is `SHOP_BADGE_STEPS[b][0]`** (lib/badge-tiers.ts) and the badges/names are main's (`SHOP_BADGE_KEYS`,
  `BADGE_REWARDS[b].title`) — the copied step table is gone.
- **The counts are main's counters**: `readFiveStarCount` · `readGiftPoints` · `readBadgeCount('shop_trusted_by_count')`
  (badge-rewards.server.ts). The unlock RPC no longer returns its own trusted-by count, and the "no counter on this
  build" claims are removed.
- **"Not counted yet" reads `BADGE_REWARDS[b].measured`** (`notCountedYet`) — no hard-coded list, so Invites flips the
  day its record lands (#7891).
- **A malformed `earned` is a failed read** (null → the badge's line says "Couldn’t load"), never `[]` / locked.
- **The drawing's words**: the rec is badge-unlock_v6 `RECS.give_gifts` verbatim ("Give a gift to the couples still
  deciding", the booked-% sentence, the points line, "N more points reach Gifts given Silver"), every number read —
  rates from the graph, points to the next tier from the live gift points and `SHOP_BADGE_STEPS`, the worked examples
  from the catalog price through `giftPointsForPrice`. The lines under the carousel are the drawing's `.more` block
  ("More graphs open as you earn badges" + each badge's line); the invented "N more … to go" copy is removed.

SPEC IMPACT: None — implements badge-unlock_v6 as drawn.
