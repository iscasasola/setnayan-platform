## 2026-11-11 · feat(nav): the account bar reads Events · People · Shop · Memories · Discover

Owner, verbatim: *"arrangement of use dashboard should be Events - People - Shop - Memories - Discover"*.
Was (live): Events · Discover · Memories · People · Shop.

- `lib/account-bar.ts` — `accountBarTabs()` returns the new order. Which tabs, and for whom, is unchanged:
  Shop only for an account that owns a shop (now third), Discover only where `/` opens (now last); a tab
  that is not drawn leaves no gap. The phone bar, the Discover page's bar and `/dev/bar-lab` all read it.
- `account-bottom-nav.tsx` — the `TAB` record is written in the new order (routes, labels, icons unchanged).
- Desktop rail (`front-door-shell.tsx`) — My Home reads Events · People · shop · Memories · HQ (Memories moved
  after Shop; HQ, never a bar tab, stays last). Discover is still the rail's first row, shared with the
  signed-out rail — not moved.
- Spotlight tour `customer_account_bar_v2` — its tab stops walk Events → People → Memories (Shop is an owner's
  tab only, so it is no stop); each step's copy unchanged, the blurb's list reordered.
- Help "What are the tabs at the bottom of the screen?" lists the tabs in the new order.
- The tab-to-tab slide direction is the tab's DOM index (`NavSlideController`), so it follows the new order
  with no change; `one-tab-slide-everywhere.test.ts` now reads the bar's real order instead of a re-typed list.
- Guards: `the-account-bar-is-the-ruling.test.ts` pins the new order for all 16 account/shell combinations and
  adds "the account-bar tour walks the bar's tabs in the bar's own order"; `every-tab-keeps-the-bar.test.ts`
  reads the real rule; `the-rail-lists-no-tools.test.ts` pins the rail's new order.

SPEC IMPACT: DECISION_LOG 2026-11-11 "THE ACCOUNT BAR ORDER: EVENTS · PEOPLE · SHOP · MEMORIES · DISCOVER"
(already recorded in the corpus by the controller; no further corpus edit).
