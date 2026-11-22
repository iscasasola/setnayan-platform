## 2026-11-22 · feat(plans): the final supplier ladder — plans are storage sizes, every tool on every paid size

Owner, 22 Nov 2026, "FINAL LADDER" + "STARTER BUSINESS", with the sizes re-cut the same day by "SUPPLIER SIZES RE-CUT" + "PLUS CUT TO 128 GB" (specs `SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md` § ★ B). Subscriptions PR 1a of the sequence.

| Plan | Storage | Live cards | People beyond the owner | Branches | Categories |
|---|---|---|---|---|---|
| Free | 1 GB | 1 | 0 | 0 | 1 |
| Verified | 5 GB | 3 | 0 | 0 | 1 |
| Plus (`solo`) | 128 GB | 15 | 2 | 0 | no limit |
| Pro | 500 GB | no limit | no limit | no limit | no limit |
| Ultra (`enterprise`) | 1 TB | no limit | no limit | no limit | no limit |

- **`TIER_CAPS`** (`lib/vendor-tier-caps.ts`) carries the ladder. On every paid size: Market Intel, theft watch, the advanced numbers, form uploads and video links, the floor-plan view, special tools; no portfolio photo cap. Free and Verified now have a storage allowance (they had none).
- **Same features in every size** (owner, 22 Nov, DECISION_LOG "SUPPLIER PLANS MIRROR ICLOUD+: ONE PRODUCT, SAME FEATURES IN EVERY SIZE"). Only storage differs; Plus keeps its starter limits (15 live cards, owner + 2, no branches). One helper, `isPaidSize(tier)` (`FIRST_PAID_SIZE = 'solo'`), now answers every former Pro-only or Ultra-only gate:
  - caps: Plus gets the time-bounded slots, editorial features, the premium page parts and top search priority; Pro's search level rises to match; the smarter chatbot level (`PLAN_CHATBOT_LEVEL`) and the supplier floor plan open from Plus;
  - the event story: every paid supplier's rich card, scene, story pages and album share (was Ultra, or Pro and Ultra), with the lock words pointing at Plus by name from the plan table;
  - the shop: microsite parts, payment methods, API keys, creators' send, the social card and posting lanes;
  - the queue order in disputes and the demo-booth rotation weigh every paid size the same;
  - plan copy (Plans page, /for-suppliers, /for-coordinators, the open-shop ladder) leads each paid size with its storage and lists every feature once under Plus; Pro and Ultra add only room and no limits. /for-coordinators now reads the /for-suppliers spec builder instead of its own copy.
- **No add-ons.** `canBuyExtraSeats` / `canBuyExtraBranches` answer no on every plan, so the extra seat and branch rows leave the plan table, the Plan screen and llms.txt.
- **Special tools** (the Cake Maker and after) open from Plus; the lock on Free and Verified reads "Included in Plus", read from the plan table (`SPECIAL_TOOLS_LOCKED_WORDS`). No unlock fee.
- **The photo challenge and the branded 3D booth** open from Plus (`PRO_TOOLS_MIN_TIER = 'solo'`, SQL twin `vendor_pro_tools_included`).
- **No typed peso for a paid plan.** `TIER_PRICE_PHP` keeps only the two free plans. The Analytics "× a year of your plan" line reads 12 × the live monthly row; no row means no line.
- **Words.** Storage reads "500 GB" / "1 TB" (`storageWords` prints TB from 1,000 GB). A no-limit plan says "No limit", "every category" or "as many … as you like", never "Infinity", "—" or "up to No limit". The public plan table leads with a Storage row. Storage refusals point Free and Verified at Plus.
- **Migration `20271360033501_supplier_final_ladder_2026_11_22`** (do-not-auto-merge):
  - `vendor_plan_contents` rows set to the ladder, with NULL meaning no limit;
  - `vendor_tier_limit` returns storage_gb 1 · 5 · 128 · 500 · 1000, and honours a stored NULL for `branches_included`;
  - `enforce_included_branch_allowance` treats NULL as no limit;
  - the finite-keys CHECK no longer covers `branches_included`;
  - `vendor_pro_tools_included` opens from Plus;
  - the catalogue plan rows' `max_categories` / `max_sub_seats` match the ladder;
  - `offer_creator_reach_hold` opens from Plus (every paid size).

  It writes no price and retires no row.
- **Not in this PR (next):** monthly-only prices and retiring the yearly / add-on SKUs, with their words on the price pages, llms.txt, `suppliers-b.ts` and `help/supplier-1.ts` (after #8150); retiring `vendor_deep_search` (the tool stays, with one run a month on Plus/Pro/Ultra from an admin setting, none on Free/Verified) and its purchase path and words; then the storage ledger and chat room (A, K).

SPEC IMPACT: None. This builds the ruled spec § ★ B; the corpus already says it.
