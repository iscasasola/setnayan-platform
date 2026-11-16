## 2026-11-14 · feat(supplier-plans): the simpler supplier plans — Free · Plus · Pro · Ultra, a year switch, add-ons folded in

Owner-approved 2026-11-14 (DECISION_LOG "SIMPLER SUPPLIER PLANS — APPROVED AS DRAWN, AND THE PLANS ARE NAMED PLUS · PRO
· ULTRA (NO "SUPPLIER")", drawing artifact Eiwc64wF1VHLfZ52Sjbs8c §§ 1–4). Items (1)–(7) and (11) of that row; (8)–(10)
(Ultra story pages, Team whole branch, Copy to another branch) are a separate build and are not touched.

- **Migration `20271346711828_simpler_supplier_plans.sql`** (allocated by `pnpm migration:new`; add/loosen only, RLS
  unchanged, no write to any shop's data): plan prices Plus ₱1,490 · Pro ₱4,990 · Ultra ₱9,990 per 4 weeks (the
  owner's figures), each year DERIVED as 10× (₱14,900 · ₱49,900 · ₱99,900); plan titles drop "Supplier"; the folded
  add-ons retired BY FLAG (is_active false + retired_at + reason, never deleted): specialized tools (4 weeks + year),
  AI chatbot (both bands), Ultra +1 category / card / waiting-list place / booking per date. Left on sale: Deep Search
  ₱499 a search, Ultra extra seat / branch ₱990. Ultra limits in `vendor_plan_contents` + `vendor_tier_limit()`'s
  fallback: 16 categories · 30 cards · 10 bookings a day. `service_card_bookings_on` now counts PER SERVICE PER BRANCH
  (every card of one category at one branch shares the day; a card on halls shares it per room).
  `vendor_specialized_tools_unlocked` includes Plus.
- **Code:** `TIER_CAPS` Ultra 16 / 30 / 10; `TIER_LABEL` Plus · Pro · Ultra (codes unchanged); `TIER_PRICE_PHP`
  fallback follows the catalogue; `SPECIALIZED_TOOLS_INCLUDED_TIERS` from Plus; the four Ultra "+1" add-ons no longer
  sold (`canBuyExtra*` false) while `holdsBoughtExtras` keeps an Ultra shop's already-bought counts until they run out;
  the chatbot is the plan's (`PLAN_CHATBOT_LEVEL`: Pro basic, Ultra the smarter level) in the inbox gate, the voice
  runtime and the voice-match gate — a bought window still counts; the chatbot buy action refuses (Plus cannot buy it).
- **For suppliers › Plans:** four tabs (Free · Plus · Pro · Ultra) and one card on a phone, four cards from 960, each
  with its own "Pay for the year" switch (the app's one `SwitchTrack`) and saving; one line replaces the add-ons box;
  the comparison is four columns (Verified joins Free) with a Pay-for-the-year row, Tools (specialized tools, AI
  chatbot) and Buy more (Deep Search, Ultra seat/branch); a phone shows one plan at a time with chips.
- **Shop › Plan and billing:** the "Pay every ▾" menu is the "Pay for the year" switch; the Add-ons row and the four
  add-on cards (AI, 3D booth, Papic Challenges, Ultra add-ons) give way to a Deep Search row with its price, an Ultra
  "Extra seats and branches" row, and a row per add-on bought before the change while it still runs; "What <plan>
  gives you" names specialized tools and the chatbot.
- **/pricing:** the supplier door names the four plans in the ◆ row style with their catalogue prices.
- **Names:** "Supplier Plus/Pro/Ultra" → "Plus/Pro/Ultra" on the supplier surfaces not edited by another open PR.

**Where we are / skipped (files other open PRs edit — names there still read "Supplier …"):** `lib/help.ts` (#7659 …),
`lib/llms-txt.ts` (#7670 — its plan TABLE follows on its own; its prose still says "Supplier …" and lists only the seat
and branch as Ultra add-ons, which is true), `lib/feature-pages/suppliers-b.ts`, `lib/locks.ts`, `lib/sku-activation.ts`,
`lib/badge-rewards.ts`, `lib/verification-plan-reward.ts`, `lib/vendor-3d-booth-pricing.ts`, `lib/vendor-photo-challenge.ts`,
`lib/deep-search-findings.ts`, `lib/ugat/graph.ts`, `app/vendor-dashboard/{actions.ts, team/actions.ts, branches/actions.ts,
_components/branch-manager.tsx, shop/_components/branch-panel.tsx, website/page-data.ts, creators/page.tsx,
payment-options/surface.tsx, clients/[eventId]/_components/booth-event-section.tsx,
subscription/_components/{ai-addon-card,booth-addon-card,papic-challenge-card}.tsx}`, `app/admin/{vendors/actions.ts,
vendors/[vendorProfileId]/plan/page.tsx, verify/page.tsx, pricing/_surfaces/pricing-surface.tsx, subscriptions/page.tsx}`.
Core files this PR had to edit although an open PR also touches them (small, different hunks): `supplier-front-page.tsx`
+ `supplier-front-data.ts` (#7627), `plan-table-data.ts` (#7678), `plan-screen.tsx` (#7608 · #7635 — the fallback-price
hunk is made identical to theirs), `(shell)/pricing/page.tsx` (#7635).

SPECIAL NOTE: no code anywhere enforces "about 30 replies a day" for Pro or "no daily cap" for Ultra — there is no
per-day reply limit at all (`lib/vendor-autoreply/no-daily-limit.test.ts`), so neither number is printed; the pages say
"included" and "the smarter level". Owner call if a Pro daily cap is wanted.

SPEC IMPACT: Applies DECISION_LOG 2026-11-14 "SIMPLER SUPPLIER PLANS" items (1)–(7), (11) to code + catalogue; no new
ruling. The corpus row already records the decision; nothing in the corpus changes with this build.
