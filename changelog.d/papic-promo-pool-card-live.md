## 2026-07-30 · feat(papic): Papic Pool goes live in Suite + Studio — and the umbrella card stops pointing at a dead SKU

`Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` **PR-C**. The flagship product of the 2026-07-29 two-type lock was a **"Soon" pill** on the only two surfaces a couple browses from, while the product itself had been on sale for a day.

**Verified against prod before flipping anything** (not against the spec, not against the comments — both were stale):

| service_code | price | is_active |
|---|---|---|
| `PAPIC_GUEST` (Pool · add 3,000 shots) | ₱1,000 | **true** |
| `PAPIC_GUEST_6K` | ₱2,000 | **true** |
| `PAPIC_GUEST_10K` | ₱3,000 | **true** |
| `PAPIC_GUEST_TOPUP` (superseded, pax-priced) | ₱2,999 | false |
| `PAPIC_SEATS` (5 Seats) | ₱2,999 | false |

Both prod events also hold a `free_grant` row, so the free shared pool is genuinely armed. And `orders` contains **zero** `PAPIC_*` rows ever — nobody is stranded by anything below.

**So the card's own blocker comment was two-thirds obsolete.** It named four gates from `Papic_Access_Scope_Council_Verdict_2026-07-20.md`: 0b (reprice off the pax curve) and 0c (the event-scoped points pool) are **closed** — the ₱2,999 pax row is the *superseded* `_TOPUP`, and the pool shipped in `20271019231590` + #3847/#3848.

**What changed**

- **`lib/add-ons-catalog.ts` · `papic-guest`** — `coming_soon` → `web_v1`; the `Soon` tag replaced with `Shared` (the one word that distinguishes Pool from One); `freeTrial: 'Free to start'`. The blurb *"One pass for the whole celebration — every guest on the list gets a camera, all day"* was the retired pax pass in a sentence — a per-**guest** promise on a product that meters **shots**, plus a roster framing the pool doesn't use (any phone that scans the event QR shoots from it). Now: *"One shared pool of shots for the whole celebration — start free, add more any time."* CTA "See the pass" → "Open the pool". No number in either: the rungs and the free allowance derive on the surface the card opens.
- **Why `freeTrial` and not the ₱1,000 price pill** — `pillFor()` prefers a trial chip over a price, and every event is auto-armed with a free pool, so a ₱1,000 headline would misprice a product whose entry cost is zero. That is the same class of claim this wave exists to delete.
- **`lib/add-ons-catalog.ts` · `papic`** — `serviceKey: 'PAPIC_SEATS'` **removed**, not repointed. The spec predicted the price pill degrades to a bare "View"; it doesn't — `freeTrial` short-circuits first. The real defect was elsewhere: `isRecommendable()` needs only `Boolean(entry.serviceKey)`, so **a coordinator could "Recommend" a SKU no couple can buy**, and `isOwned()` could never be true so the owner deep-link never fired. Papic has no single representative SKU any more — two products across five active rows — which is exactly what `variablePricing` already declares. Repointing at a Pool or One SKU would name one rung as "the" Papic price.
- **`studio/page.tsx`** — the ⚠ comment claiming *"this does NOT make anything purchasable… all four PAPIC_GUEST* catalog rows are is_active = false"* is now false in both halves; rewritten. **`papicGuestPassAccess()` is KEPT** — the spec called it a "dark-gate", but it is event-type **eligibility** (permanent travel deny · anniversary controller split · phase ladder) and it fails closed for new types. Deleting it would offer the pool on a roaming multi-day trip, and widening it is an owner/DPO call by the module's own rule.
- **`lib/add-ons-detail.ts`** — highlight *"Try it free before you commit"* → *"Your first shots are already free — no card"*. It isn't a trial: the free pool and the free One camera are permanent and auto-armed. No literal, because both allowances are admin-editable in `papic_event_pool_config`.
- **`lib/studio-recommendations.ts`** — `papic-guest` added to `STUDIO_RECOMMEND_EXCLUDED`. Pool is a **product under Papic**, chosen on the surface the `papic` card already opens (which carries the family's peak month 2 + `dateLocked`), so auto-recommending it beside its own umbrella would push the same product twice. Still browsable; still coordinator-recommendable (that path keys off `serviceKey`, not this set).

**Owner naming lock, applied same-day (owner: _"we do not have papic guests — we only have Papic Pool and Papic One"_).** `PAPIC_GUEST` / `papic-guest` / `papicGuestPassAccess` are frozen technical ids from before the products were named, and stay (never-rename-technical-ids). What changed is every **display** name in reach of this PR:

- `[slug]/_components/editorial/data.ts` — the guest-site "Powered by" label map said `PAPIC_GUEST: 'Papic Guest'`. Now `'Papic Pool'`.
- `studio/papic/moderation/page.tsx` — the empty state told couples to *"add the Premium Guest Camera Pack"*, **a product that has never existed under any pricing model**. Now names Papic Pool.

Remaining `Papic Guest` display strings are logged for the sweep: `app/page.tsx:127` + `layout.tsx` SEO copy (**PR-F**), and `initialize-maya/route.ts` `TITLE_BOOK` (demo-only, never billed).

**Three guards moved with the flip, deliberately in the same PR:**

- `add-ons-catalog.test.ts` — the old `'Papic Buong Araw stays unbuyable until its Phase-0 gates land'` test instructed *"flip this assertion in the SAME PR that flips the status — never before."* Done. Its replacement asserts the status is live **and** that the blurb carries no `every guest` / `all day` / `per guest` / `on the list` / `seat` language and no peso-or-points literal — so the retired pax model cannot creep back into the sentence that carried it. A second test pins `papic` to no `serviceKey` with `variablePricing` intact.
- `add-ons-detail.test.ts` — the free-or-paid invariant now accepts `freeTrial` as a third declaration, because it guards `pillFor()` and that function resolves `owned → pending → tier:'free' → freeTrial → price ?? 'View'`: a card with a trial chip **cannot** reach the bare "View" the invariant exists to prevent.
- The Studio drift guard is satisfied by the `STUDIO_RECOMMEND_EXCLUDED` entry rather than by silence.

**⚠ COMPLIANCE ITEM, ESCALATED NOT ABSORBED — verdict gates 0d/0e are still open.** The guest-media ROPA row and the DPO sign-off that the RSVP consent text names guest-phone capture + face-sorted delivery are `[PENDING DPO]` from 2026-07-20 (`Papic_Compliance_Delta_2026-07-20.md` §2.2). They are **not** a blocker on this card and never were: the sale they were written to gate went live on 2026-07-29 through the studio and the guest buy sheet (#3874, flag ON in prod), so guests are already shooting and already buying. Darkening one doorway would have hidden the inconsistency without closing the gap. Filed as its own item in the spec's §5 for the owner — deletion of a "Soon" pill must not launder a compliance decision.

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · **`test:unit` 5,385/5,385 pass**. Live prod reads for the catalog / grants / orders tables shown above. No local `npm run build` (7 GB heap → SIGTERM 143).

**Side effect confirmed as intended, not introduced here:** `[slug]/_components/site-body.tsx` mounts the inline guest camera when the event holds an **active, admin-approved** `PAPIC_GUEST` pack — so buying a pool top-up activates it. That path was already reachable via the studio and guest-buy surfaces before this PR; the card flip adds a doorway, not a capability.

SPEC IMPACT: Applied to the corpus — `Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` (§2-C closed; §0 RETIRED list gains "Papic Guest" as a display name; §5 gains the 0d/0e DPO item) + `DECISION_LOG.md` (the naming lock + the gate reconciliation). No price, SKU or schema change: every SKU touched was already `is_active` as shipped by the owner's 2026-07-29 lock.
