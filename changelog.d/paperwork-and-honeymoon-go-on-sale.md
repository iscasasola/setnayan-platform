## 2026-08-27 · feat(marketplace): the marriage-paper helper and the honeymoon planner go on sale — the priest does not

⚖ **Owner ruling 2026-08-27, verbatim**, asked which of the four admin-only branches should become things a supplier can list and a couple can book:

> *"for priest (there are rules) so this needs to be under their church (which is at the ceremony venue). marriage-paper helper yes. honeymoon planner yes"*

| branch | | |
|---|---|---|
| `officiants` (20 services) | **stays shut** | A priest is not shopped for. `officiant-auto-resolve.ts` has surfaced *"the priest from your parish officiates"* since 2026-05-30 — that IS the ruling, already built. |
| `counseling_seminars` (5) | **stays shut** | He was not asked about it, so it does not move. Pre-Cana attaches to the rite the way the officiant does. Opening it is his call, not a tidy-up. |
| `wedding_paperwork` (3) | **OPENED** | marriage-licence expediting · apostille / DFA · Fil-Am visa logistics |
| `travel_honeymoon` (2) | **OPENED** | honeymoon planners · destination-wedding travel coordinators |

### ⚠ "Bookable" is four things, not one flag

Flipping `marketplace_hidden` on the branch is the obvious change and would have shipped a category nobody can reach. Each layer refuses independently and **silently**:

1. **The leaf** and **the branch** must both be visible — `getCoverageTaxonomy` drops a hidden leaf *and* a hidden branch, so a half-flip leaves five services no vendor can select and no couple can find, with nothing reporting it.
2. **The branch needs a coarse category, and it is a Postgres ENUM.** `vendor_profiles.services[]` stores `public.vendor_category`, and `BRANCH_TO_VENDOR_CATEGORY` is the only bridge. A visible branch missing from that map files every vendor under it as *"Miscellaneous"* — measured at **194 of 246** services on 2026-08-09, which is why that guard exists. Two enum values are added here and the TypeScript map gains its two rows in the same PR. 🔑 A value the code writes but the enum lacks is **rejected, not thrown**: the INSERT fails at runtime and the only symptom is a vendor whose signup did not stick.
3. **A bookable category with no PLAN_GROUP is half-shipped.** `bucketVendorsByGroup` parks a pick no group claims into the `logistics` fallback — *"Logistics & Misc"*. Without a card of its own, a couple could shortlist a marriage-licence expediter, lock them, and find the money filed under Misc. `shortlist-taxonomy-coverage.test.ts` said so by name the moment the categories were added. Two plan groups ship here — **Marriage papers** (paper tier, 4 months out: the licence is only valid 120 days) and **Honeymoon** (extras tier, 3 months).
   ⚠ **`GAP_LEAF_PARENT` was the other candidate and is the WRONG home.** That registry is pinned to the 2026-07-20 gap-leaf document (*"the doc lists exactly 14"*) and every member is a **non-wedding** event-type leaf a wedding couple never meets. These two are wedding-only — which is exactly why a wedding couple would notice the money vanishing.
   🔑 Both scope themselves to weddings for free: `planGroupsForEventType` joins `catalogTile` to `service_categories.applicable_event_types`, and both tiles are `['wedding']`. No birthday host gains a card.

### ⚖ And Paperwork & Government changes folder: `venue` → `planning`

It was a sibling of Ceremony under **"Venues & churches"** — correct while it was an admin-only filing cabinet, wrong the moment a couple can browse it. Nobody hunting for someone to expedite a marriage licence opens "Venues & churches"; they open **"Coordinators & planners"**, which is where Travel & Honeymoon already sits. The branch and all three leaves move together so the `folder_id` = branch `parent_id` invariant holds.

🔑 **The folder-count baseline is the proof that nothing else moved:** `planning 12 → 17` and **`venue` UNCHANGED at 28**. The three paperwork services left `venue` but were marketplace-hidden, so they were never in its count — a folder move alone would have read `-3/+3`. Seeing `+5/-0` is what says the delta is exactly the five services that went on sale.

### 🛡 Guards

- The migration **asserts the two that stay shut**, in SQL, before it commits: a `DO` block raises if `officiants` / `counseling_seminars` or any service under them has become visible. A migration that opens two of four is one careless `WHERE` away from opening all four, and this fails the deploy instead of shipping a supplier category the owner never agreed to.
- `tests/db/every-service-has-a-tile.db.test.ts` gains a **seventh case, the mirror of its fifth**: the two opened branches must stay visible, must have at least one visible service, and must not hang under a hidden folder. "Everything is filed" and "nothing leaked" are both satisfied by a change that quietly re-hides these — which would take five services off the marketplace with no error anywhere. Its `ADMIN_ONLY_BRANCHES` list shrinks 4 → 2 and its floor 30 → 25, **because the owner shrank it, not because a test went red**.
- `shortlist-taxonomy-coverage.test.ts`'s `VENDOR_CATEGORIES.length` contract goes 47 → 49 — **re-derived, not bumped**: both new categories bridge 1:1 to their same-named live tile, both are claimed by a real PLAN_GROUP, and neither is a gap leaf, so every assertion that made 47 meaningful still holds at 49.

### Verification

`typecheck` 0 errors · full `test:unit` and `test:db` green. **Pre-flighted read-only against live production:** all 5 services present and currently hidden · 3 under paperwork + 2 under travel = exactly 5 · both branches currently hidden · the `planning` folder is open, so the opened branches are reachable · the enum currently lacks both values (so the `ALTER TYPE` is not a silent no-op) · the two shut branches leak nothing today.

SPEC IMPACT: **Two new bookable supplier categories.** No price, SKU or fee change — the booking fee and every payment path are untouched. Corpus row: `DECISION_LOG.md` 2026-08-27.

### The typecheck found the fourth thing

Adding two `PlanGroupId`s broke three **exhaustive** `Record<PlanGroupId, string>` copy tables in `lib/todays-one-thing.ts` — *why it matters* · the CTA label · the action title — the hero card the couple actually reads. No grep for the category names would have found them; the type did. Filled in brand voice (*"The licence is only good for 120 days, and the CENOMAR plus your parish papers take weeks to gather"* · *"Sort your marriage papers"* · *"Plan your honeymoon"*).

⚠ **Noted, not fixed here:** the untouched `officiant` plan group still deep-links via `subcategoryHint: 'officiant_priest_minister'`, a canonical that is marketplace-hidden — so *"Find an officiant"* on the same hero card is the same fake door [#4899](https://github.com/iscasasola/setnayan-platform/pull/4899) fixes on the Essentials card. Different file, different PR; called out so it is not discovered as a surprise.

**7 mutations across the two PRs of this ruling, each measured by occurrence count before → after, each RED on the intended assertion.** The three that matter here: a careless `WHERE` opening all four branches → the migration's own `DO` block **raises and the whole replay fails**, which is the deploy refusing rather than a test complaining · quietly re-hiding `travel_honeymoon` → case 7 · opening a branch while leaving every service under it hidden → case 7 again, on the visible-leaves arm rather than the hidden arm.
