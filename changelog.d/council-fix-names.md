## 2026-07-22 · fix(vendors): "open it up" — a vendor's name is never gated

Builds the owner-locked "open it up" decision (`Vendor_Subscription_Ladder_2026-07-22.md`
§3 + sign-off log: *"name & inbox are NEVER gated. Couples always see who's there…
Paid tiers buy PROMINENCE and REACH… never EXISTENCE."*). The inbox-free half had
shipped; the NAME paywall was still live.

**What was wrong.** The marketplace name-reveal keyed on tier: `TIER_CAPS.verified.nameMode`
was `'screen'` (anonymized screen-name until the vendor's first chat reply or a paid
upgrade), and two consumers (`lib/vendor-cards.ts`, `saved-vendors.ts`) hardcoded
`PAID_TIERS = {pro,enterprise,custom}` for the reveal. Because verification never
changes `tier_state`, a **real verified vendor sits at `tier_state='free'`** — so a
tier-keyed reveal left qualified vendors anonymized in the couple-facing marketplace.

**Fix — reveal on VERIFICATION, not tier.**
- `lib/vendor-tier-caps.ts`: `verified.nameMode 'screen' → 'true'` (removes the name
  paywall on the legacy free-verified tier). `free` stays `'hidden'` + `marketplaceSearchable:false`
  (conservative default for a truly-unverified vendor — unchanged). Reach/seats/categories/
  market-intel untouched (prominence & reach stay tiered — allowed by the lock).
- `lib/vendors.ts`: new `is_verified` input on `VendorAnonymityInput`; `isVendorNameRevealed`
  reveals when `verification_state='verified'` on ANY tier. Additive — the venue-exempt,
  paid-tier, and `name_revealed_at` reveal paths are unchanged. An UNVERIFIED vendor
  (`is_verified` false) never reveals via this path, so the de-gate can't over-expose
  unverified real names even on surfaces whose query isn't verification-gated.
- Threaded `verification_state` → `is_verified` through all 17 name-consumer call sites:
  explore vendor card + folder strip, `/v/[slug]` + booth, couple category-search +
  bench-marketplace-search, shortlist picks + saved/library (`hydrateVendorCards`),
  messages (couple thread list/header + `lib/chat.ts` embed), showcase editorial credits,
  creator public/offers, vendor "trusted-by". Added `verification_state` to the selects/
  types that lacked it.
- `lib/vendor-cards.ts` + `saved-vendors.ts`: replaced the `PAID_TIERS` hardcode with
  `isTrueNameTier(tier)` (the §6-audit-flagged bug — also un-anonymizes paid Solo).
- Copy: `public/llms.txt` vendor-tier table + prose + "why is a name hidden" FAQ rewritten
  so the upgrade reason is prominence/reach, not "name shown from day 1"; `llms-price-drift`
  stays green (no peso figures touched). `VENDOR_TIERS_AND_BENEFITS.md` matrix + §1/§4/§6
  "real-name-as-Solo-edge" claims corrected; handoff-log entry added.

Tests: new `lib/vendors.test.ts` (verified-reveals-on-free-plan · unverified-stays-hidden ·
additive-legacy-paths · venue/paid still win) + new `nameMode`/`isTrueNameTier` assertions
in `lib/vendor-tier-caps.test.ts`. Full `lib/**` unit suite + `tsc --noEmit` green.

Owner notes surfaced for review: (a) real verified vendors carry `tier_state='free'` today —
the reveal works because it keys on verification, not tier; (b) `bench-marketplace-search`
is not `verification_state`-gated at the query layer (pre-existing PR-B gap; name-safe now
but unverified vendors still appear as placeholders — consider adding the filter);
(c) `VENDOR_TIER_SEARCH_GATE` (tier-based existence exclusion) contradicts the lock and
should be retired, not enabled.

SPEC IMPACT: The decision is already locked in the corpus (`Vendor_Subscription_Ladder_2026-07-22.md`
§3 + sign-off log) — this PR builds the un-built code half; no new corpus body edit needed.
Retires the "name reveal is a paid/first-reply upgrade" mechanic that older iteration specs
(0006/0019/0022 hybrid-anonymity) still describe — those are archive stubs; the code +
`VENDOR_TIERS_AND_BENEFITS.md` are now canonical. A `DECISION_LOG.md` row is warranted:
"2026-07-22 · vendor name never gated — reveal keyed on verification_state, not tier."
