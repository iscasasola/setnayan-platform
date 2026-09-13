# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-06 · feat(nav): the directory is "Suppliers", the event surface is "Your Team"

Owner ruling. Supersedes the 2026-08-12 "one word on both sides" decision for the ACCOUNT-vs-EVENT
split (the signed-out/signed-in seam guard is untouched and still enforced — see below).

### Why one word kept failing

The label drifted three times in three months — **Explore → Merkado → Marketplace** — because one
word was being asked to name two different products:

| slot | route | what it is | icon |
|---|---|---|---|
| `customer.account.marketplace` | `/explore` | date-blind public browse, no event, no budget | **Store** |
| `customer.bottom-nav.explore` · `customer.sidebar.explore` | `/dashboard/[eventId]/vendors` | the couple's own event surface | **Compass** |

**The icons already disagreed.** A store and a compass. Only the label pretended they were one
thing.

The event surface is not a store: the taxonomy hands each event a FINITE, pre-computed set of
positions (filtered by faith + event type before the couple sees anything), search is hard-scoped so
a couple cannot drift categories, and `event_category_decisions` lets a position be retired
outright. Nobody excludes an aisle from a shop. Its four sections — Bench · Picks · Plans · Payments
— are all about the team, so **Your Team** is the superset word; `/explore`, which really is a
directory of who exists, becomes **Suppliers**.

### Also: the `build` section is now "Picks"

With the page titled "Your Team", the section previously called "Your team" would have made the page
name itself twice — the defect the owner caught in July (*"why does the build your team has build
your plan and your team?"*).

**"Chosen" was considered and rejected on evidence:** the binding prototype renders
`★ Chosen` as the corner badge shown if and only if a vendor is `locked`, and
`app/_components/app-store/studio-card-demo.tsx` ships that same badge. Naming the section "Chosen"
would put a locked-only word on a section holding locked, mid-handshake AND candidate vendors.
**Picks** is the codebase's own noun for exactly that set (`AccordionPick`, `PlanBuildPick`,
`planPicksToApply`, `saveVendorToPicks`), claims no finality, and leaves ★ Chosen meaning locked.

### 🔒 A guard that was missing on the event side — added

The ACCOUNT row has had a two-file guard since 2026-08-15, after one row shipped wearing two words
for three days. **The EVENT row had none.** Measured during this rename: reverting the registry's
event label to "Marketplace" broke **nothing**, because `customer-menu.ts` feeds the phone while the
nav registry feeds `/admin/menus` and the desktop rail, and nothing compared them. An admin rename,
or a half-applied one, would have shipped silently.

New case in `two-levels-and-the-board.test.ts`: the phone menu's `explore` label must equal the
`customer.bottom-nav.explore` registry default, and the sidebar slot must equal the bottom-nav slot.
Same defect class as August, opposite side of the app.

🪤 **Both guards scan at most 400 chars from a key to its label — and this PR's own first draft
broke both of them with a long explanatory comment.** The comments are now short and say so. The
rationale lives here instead, where no regex has to scan past it.

### Copy that named the old page

`_PlanningToolkit.tsx` (en + tl twin) said unfinalized suppliers *"stay in the Marketplace"*, and
`/waitlist` advertised *"Marketplace browsing"*. Both now name a page that exists. `Supplies
Marketplace` (the Paprint SKU) is a DIFFERENT product and is deliberately untouched.

### Unchanged on purpose

Slot **keys** (`explore`, `customer.account.marketplace`), routes, `?tab=` deep links, saved links,
and every identifier / DB column (`marketplace_vendor_id`, `fetchMarketplaceServices`,
`MarketplaceVendorSuggestion`) — the 2026-07-27 precedent: churn without user benefit. The
signed-out/signed-in seam guard still passes untouched, because it compares the front-door fallback
against the ACCOUNT slot and both became "Suppliers".

### Tests

142 across the seven affected + adjacent suites, plus the 3 features-copy guards (19). Mutation-
checked in both directions: reverting the account label RED-s the seam guard; drifting the registry
event label from `customer-menu.ts` RED-s the new guard; drifting the sidebar slot from the
bottom-nav slot RED-s it too. Restored, all green.

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-06 — label canon (`/explore` = Suppliers; the event
surface = Your Team; the `build` section = Picks), superseding the 2026-08-12 account/event
one-word decision. No SKU, price, schema or migration change.
