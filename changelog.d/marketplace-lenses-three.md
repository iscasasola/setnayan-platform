## 2026-07-27 · feat(marketplace): the honest inputs for the three remaining ranking lenses — demand, freshness, budget-est., and the privacy leg that gates them

Groundwork for `Explore_Replan_BUILD_SPEC_2026-07-27.md` §15's last three lenses — **"Fits your budget"**, **"New here"**, **"In demand right now"**. This PR lands everything those lenses need that is NOT the lens mechanism: the honest data sources, the honesty guardrails, and the privacy disclosure §15.4 makes a hard prerequisite.

> ⚠ **Scope note.** The lens registry (`lib/ranking-lenses.ts`) and the first two lenses were being built in a sibling PR on `claude/marketplace-lenses`, which had not opened after 60+ minutes of polling. Rather than fork the scorer or write a second one — explicitly forbidden by §15.0 — this PR ships only what is independent of that registry. **The three weight vectors and their sort-control chips are NOT here.** Every input they consume is, tested and flag-dark, so adding them is a small follow-up: three rows in the registry and three chips.

Everything user-visible is behind `isExploreReplanEnabled()`. Flag OFF, the bench renders and queries exactly as production does today — including the same number of round trips.

### 1 · "In demand right now" — the two defects that blocked it are fixed

§15.3 blocked this lens on two grounds. The owner approved it **only in the honest form**; both are now closed.

**Re-sourced to INQUIRIES, not saves.** `eyeingByVendorId` counted `event_vendors` rows at `status IN ('considering','contracted')` — and `'considering'` is written by *merely saving* a vendor (`explore/actions.ts:198`, `onboarding/wedding/actions.ts:634`) with zero contact ever made. The owner's 2026-06-02 ruling is explicit: *"Starts at the inquiry (Stage 2), NEVER at search (Stage 1) … counting it as competition = manufactured scarcity (a fineable dark pattern)."*

The new count **joins on `chat_threads` existence**. That table is `UNIQUE (event_id, vendor_profile_id)` and a row exists only when a couple actually reached out — `_actions/unlock-category.ts:187` is the clean pattern (it inserts `considering` **and** fires an auto-inquiry), as is the manual path in `app/v/[slug]/inquiry-actions.ts`. **A saved-but-never-contacted vendor contributes ZERO**, and a unit test says exactly that. The follow-up read is bounded by the hold set, so it costs one small query and can never be a scan.

**Min-N floor of 3, enforced twice.** §8.3: *"Don't show a '1'."* n=1 on a solo vendor plus an exact date in a small municipality is functionally re-identifying. The floor is applied (a) at the **server boundary**, so a below-floor count is never serialised to a client at all, and (b) inside `compatSubScores`, so any other caller that ever passes a raw count still cannot render one. Tested at n=1 and n=2 (nothing renders) and n=3 (the first count that ships).

**The limitation is stated, not papered over.** The count is **EXACT-DATE ONLY** (`.eq('events.event_date', eventDate)`). A couple still at month or year precision gets **no count and no fallback** — none is fabricated.

**⛔ Forbidden copy, enforced by test:** "Only N left", "booking fast", "almost gone", "lock it in soon". None is backed by a capacity counter that exists — `vendor_schedule_pool_bookings` has **no cross-couple SELECT policy**, so "N slots left" is not buildable, and soft holds never consume capacity anyway. The only shipped phrasing is the measurement: **"3 couples inquired for your date"**.

`demandPressure` joins `COMPAT_WEIGHTS` at **weight 0**, so every existing caller (`category-search.ts`, `build-3state-actions.ts`, `build-3state-fallback-actions.ts`, `app/tour/vendors/page.tsx`) is byte-for-byte unchanged — asserted by test. Its sub-score is shaped like `faithFit`: a **lift** for the positive case, NEUTRAL otherwise, **never a penalty**, because "nobody inquired" and "we have no data" are indistinguishable. The lift saturates at 10 couples so a runaway count cannot dominate a weighted composite.

### 2 · "New here" — the anchor, and why it is not the obvious column

§15.1 needs a `freshnessRatio` off "the vendor's verification approval timestamp". **Three candidates, all checked against prod before anything was built:**

| Candidate | Verdict |
|---|---|
| `vendor_profiles.created_at` | ⛔ Row-insert time. For admin-seeded profiles (`20260528000000`) it is the **admin's** date. |
| `vendor_profiles.last_verified_at` | ⛔ **Overwritten on EVERY approval** (`admin/verify/actions.ts:150` and `:361`), so an established vendor who just passed their annual renewal would read as brand new. Migration `20260516050000` also backfilled it to that migration's own `NOW()`. Prod: **0 rows populated** — including the one profile that *is* `verified`. |
| `vendor_verifications.approved_at` | ⛔ Prod: **0 rows in the whole table.** Nothing in the app writes it. |

**Chosen: `MIN(vendor_tier_history.created_at) WHERE to_state = 'verified'`.** `vendor_tier_history` is an append-only audit of verification-state **transitions**, written only when the state actually MOVES (`toState !== fromState`). That makes it honest *by construction*: a renewal of an already-verified vendor writes no row and **cannot reset the anchor**, while a demote → re-verify writes a second row that `MIN` correctly ignores. Both approval paths are the only writers of `verification_state = 'verified'`, so coverage going forward is complete.

**No new column and no migration** — CLAUDE.md Rule 3 ("a flag/filter flip beats new schema"), and it answers spec §15.9 decision #1 without needing one.

Absent anchor → **null → NEUTRAL 0.6, never 0** (the admit-unknown rule, `compat-score.ts:57`). Freshness only ever *lifts*, so a missing anchor withholds a newcomer's head-start but can never make an established vendor falsely read "New on Setnayan" — the safe direction to fail. Prod has 0 `vendor_tier_history` rows today, so every vendor is NEUTRAL and the lens will hide itself under the §15.2 visibility gate. That is correct behaviour for an empty marketplace, not a bug.

### 3 · "Fits your budget" — the label is load-bearing

The mandatory **`est.` qualifier** now rides the lens reason pill, reusing the shipped `ShortlistVendor.budgetEstimated` (which already drives "Fits budget · est." on the fit-badge) rather than re-deriving it. An estimate can no longer read as a firm number in one place and an estimate in another.

**The card may never say "best value", "cheapest", or "most for your money."** `priceFitScore` (`lib/smart-sort.ts:148`) returns a **flat 1.0 for every vendor at or under budget** — a ₱30k and an ₱89k photographer tie *exactly*. The dimension ranks **distance from over-budget**, not value. A unit test asserts the tie and greps the rendered pill for the banned vocabulary.

⚠ **Stated, not silently conflated:** the bench card DISPLAYS `event_vendors.total_cost_php` (a real quote) while the scorer CONSUMES `vendor_services.starting_price_php` (a "starts at"), via `vendorBudgetFitRatio`. Two different numbers about the same vendor. Nothing here merges them.

### 4 · `/privacy` — the transparency leg, and a contradiction it forced

§15.4 makes this a hard prerequisite: *"Before any lens or chip derived from another couple's planning behaviour ships."*

New section, **"Vendor interest counts (what other couples can see)"**: saving or inquiring contributes to an **aggregate, de-identified** count visible to other couples planning the same date; only the count is shared — never name, account, email, event, budget, or *which* couples; vendors are not shown it; the "In demand" ranking uses **inquiries only** and suppresses anything below three; the count is exact-date only; and Setnayan never presents it as scarcity.

⚠ **The OAuth contradiction is reconciled.** Three sections — TikTok, YouTube/Live Studio, Google Drive — promised data is *"never shared with vendors, other couples, or third parties"*. Each is genuinely about a **connection credential**, but a reasonable reader takes it as a blanket denial that this feature contradicts. Each now reads *"These credentials are never shared…"* and carries an explicit scope note pointing at the new section. Left as written, the page would have become false the moment the flag flipped.

This section is deliberately **not** flag-gated: its first paragraph describes behaviour that is live *today* (the Setnayan-AI-gated eyeing chip), and a disclosure that lands after the feature is worth nothing.

### Also

- `lib/same-date-demand.ts` (new) holds the inquiry-vs-save discrimination and the floor as pure functions, so both honesty rules are unit-testable without a database. 13 tests, each stated as the defect it locks out.
- Flag ON, the legacy `plan-budget-accordion` eyeing chip reads the SAME honest floored count — a lens saying "3 couples inquired" must never sit beside a chip saying "1 also eyeing" off a different basis. Flag OFF it is untouched.
- A LOCKED pick carries no demand signal. Telling a couple that others are competing for the vendor they already booked is noise at best and pressure at worst — same "locked skips" discipline as the budget and date badges.

### Owner decisions surfaced, not taken

1. **Is "In demand" paid-only?** The signal is already Setnayan-AI-gated everywhere it exists (`vendors/page.tsx` hands `buildPlanBudgetModel` an empty map when AI is off). This PR **mirrors** that gate rather than quietly widening or narrowing it. Product call.
2. **Opt-out + DPO sign-off** (§15.4 legs (b) and (d)) are NOT built. Transparency and the min-N floor are. **The flag must not be flipped until both land.**
3. **Two live honesty exposures next door**, unchanged here on purpose (§15.9 #3): `app/_components/app-store/studio-card-demo.tsx:839` renders a **hardcoded** "3 also eyeing your date" on public marketing, and `app/vendors/_components/vendor-grow-sections.tsx:230` **sells** the nudge to vendors — *"we tell your client that schedule is in demand — so they move"* — while the signal underneath is (flag OFF) still a save-count rendering at n=1.
4. **`vendor_profiles.last_verified_at` is NULL on a profile that IS `verified`** in prod, so nothing ever wrote it. That column also feeds `next_renewal_due_at`, which means the annual re-verification countdown has the same gap. Out of scope here.

SPEC IMPACT: `Explore_Replan_BUILD_SPEC_2026-07-27.md` §15.3 — "In demand right now" is no longer blocked on its first two conditions (inquiry-sourcing, min-N) or its fourth (privacy transparency); condition 3, the capacity RPC, remains unbuildable and the lens does not claim capacity. §15.9 decision #1 (freshness anchor) is answered **without a new column**: `MIN(vendor_tier_history.created_at) WHERE to_state='verified'`. Logged at the bottom of `DECISION_LOG.md`.
