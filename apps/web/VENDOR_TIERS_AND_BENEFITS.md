# Vendor Tiers & Benefits — canonical spec

> **Shared source of truth for the vendor tier model + benefit catalog.**
> Owns: what a vendor gets at each tier, the naming, and the honest build-status
> of every benefit. Drives both the `/for-vendors` marketing page AND the
> `/vendor-dashboard` gating. Two sessions edit this — see the protocol below.

## How the two sessions use this doc

Two Claude Code sessions coordinate through this file (both work in `apps/web`):

- **Marketing/strategy session** — owns `app/for-vendors/*`, pricing copy, the benefit catalog + tier allocation below.
- **Dashboard session** — owns `app/vendor-dashboard/*`, wires the actual tier gates (`lib/vendor-tier-caps.ts`, entitlement checks).

**Protocol (both sessions):**
1. **Read this doc first** at the start of a work chunk.
2. When you change something the other session needs (a tier gate, a benefit's status, a rename), **append a dated entry to the "Cross-session handoff log"** at the bottom.
3. **Commit the doc in the same PR** as the change. Git is the sync mechanism — the other session gets it on pull.
4. Don't merge the sessions. Keep strategy and implementation separate; this doc is the seam.

Status markers used throughout: **✅ built** · **⚠️ built but thin — verify working surface before publishing** · **🔭 roadmap, not built.**

---

## 1 · Locked decisions

- **0% commission (locked).** Setnayan never takes a cut of a vendor booking and never holds the money. → vendor revenue comes ONLY from **subscriptions + tokens**. This is why the free/paid line *is* the business model.
- **Model: "Free to join, subscribe to scale."** Free-Verified must be *more generous than most competitors' paid plans* (marketplace-liquidity land-grab). Paid tiers gate *scale + growth*, never the basics (being found / messaged).
- **Answering monetization (CORRECTED by §6 audit — origin/main).** There is **no token-free answering tier.** Every answering tier is `inAppGated=true`: Verified answers up to **10/week** (each still burns a region-banded token ₱100/200/300); **Solo/Pro/Enterprise = unlimited VOLUME**, each answer still burns a token. So the earlier "**Solo = unlimited answering, no tokens**" linchpin is **FALSE in code** — Solo's real edge over Verified is unlimited volume + real-name-day-1 (`nameMode 'true'` vs `'screen'`) + `servicesPerLeaf` 3 vs 2. Owner decision open (see §6).
- **"Setnayan AI" is a CUSTOMER product**, and it's **deterministic (rule-based), not an LLM** (locked). On the vendor page it's an *indirect* benefit: couples who plan with Setnayan AI arrive matched to your fit and further along = better leads. The vendor never "uses AI."
- **Proposals: "Basic Proposal Builder" (Solo, shipped, zero-LLM template+merge) vs "Advanced Proposal Drafting" (Pro).** The label **"AI Proposal Builder"/"AI proposal drafting" is retired** — it overclaimed a `Zero LLM` feature. "Advanced" = multi-option packages, dynamic line-item pricing, branded PDF + e-sign, conditional inclusions (buildable, non-AI). 🔭 build before claiming.
- **Prices are provisional / admin-managed** — read from the live catalog DB (`getVendorPrices`), never hardcoded. Ladder B (locked 2026-07-01): Solo ₱999 · Pro ₱2,499 · **Enterprise ₱7,499** (per 28d) · annual Solo ₱9,999 / Pro ₱24,999 / **Ent ₱74,999**. **Enterprise is a bounded "larger range" (NOT unlimited); a Custom "Talk to us" tier sits above it** (see §2).
- **Boost radius is the one-number upgrade ladder:** Local → 20 → 50 → 100 km.

---

## 2 · Tier allocation ("starts at")

Each benefit appears at the **lowest tier that unlocks it** and carries upward.
Tier identities: **Solo = operate · Pro = grow · Enterprise = scale.**

### 🆓 FREE — VERIFIED (₱0 · verified free during launch)
*Job: get found, get trusted, get contacted, bring your business with you.*

**Discovery & matching** — appear in matched searches · matched on fit not fame · "no reviews" ≠ risky · hidden-until-you-reply · real fillable shortlist · hand-curated ops intros · **free weekly couple unlocks** · precision matching by attributes ✅`vendor-service-attributes`
**Credibility** — verified badge (free during launch) · profile + microsite · portfolio (≤10) · star ratings · recent-reviews carousel ✅`vendor-reviews-preview` · earned badges New/Verified/Top Pick/Most Booked ✅`vendor-badges` · experience-tier badge ✅`vendor-experience` · "recommended by N couples" ✅`vendor-recommendations` · fair Bayesian rating ✅`vendor-activity`
**Bring your business** — import past clients free ✅`vendor-invites` · past weddings → reviews · claim-QR · "verified wedding" pill
**Get contacted + close** — one pipeline (request→chat→quote→accept) · reply-speed shown & ranks · pre-qualified inquiries · service packages + 1 category · set-your-price-once · **Basic Proposal Builder is Solo (see below)** · payment-options display ✅`vendor-payment-methods` · real-time notifications ✅`notifications` · email alerts ✅`vendor-email-triggers` · availability helps couples pick a date ✅`vendor-availability` · basic calendar · song bank/repertoire (music acts only) ✅`repertoire` · control visibility ✅`vendor-visibility` · your own Performance panel ✅`vendor-stats-panel` · redeem codes ✅`redeem-code` · manpower gigs ✅`manpower`
**Exposure when booked** — credited to guests as "vendors who made this day" ✅`event-vendor-credits` · appear in couple's planner + budget ✅`vendors-plan-budget`
**Always true (all tiers)** — 0% commission · never hold money · no EWT/2307 (vendor is income recipient; tax-docs surface retired 2026-05-29) · logo (not personal photo) in chat · ~~read files in-thread~~ (⚠ NOT built — thread file-attachments don't exist yet; do not claim as live · 2026-07-01) · coordinator per-thread join · event types unlock over time · merit-only ranking · can't-buy-your-way-up
**Usage (all tiers)** — boost radius **Local** · 7-day boosters · token packs · pay-per-lead answering after weekly unlocks

### ⭐ SOLO — ₱999/28d · *operate, friction-free*
**+** **1 team seat** (operator + one helper — owner 2026-07-02) · **Unlimited answering — no per-lead tokens** (linchpin) · full portfolio · calendar .ics export + hybrid scheduling · bookable time slots ✅`vendor-time-slots` · **Basic Proposal Builder (templates + merge tokens)** ✅`vendor-proposals` (Zero LLM) · set your own payment schedules ✅`vendor-service-payment-schedules` · in-app contracts + e-sign ✅`contracts` · client CRM ✅`clients` · earnings dashboard ✅`earnings` · see couple's mood board before quoting ✅`moodboard-library` · file sharing with couples · post-event recaps ✅`recaps` · bookings pipeline dashboard ✅`bookings` · Performance **trends over time** · boost **20 km**

### ★ PRO — ₱2,499/28d · *grow (team + intelligence + reach)*
**+** 3 categories + 3 team seats (roles + privacy redaction) · **Advanced Proposal Drafting** 🔭 · category benchmarks ⚠️ · demand pulse ⚠️ · conversion-vs-peers 🔭 · editorial tagging → Real Stories ✅`realstories-vendor`/⚠️ · reverse-image theft watch ⚠️ · onboarding bundle maker ⚠️ · specialized per-category toolkits ⚠️ · co-listing with Productions ✅`partnerships` · custom slug + Bid Button · full written reviews · multiple events/day · additional branches ✅`branches` · same-day work opt-in ✅`same-day-vendors` · vendor referrals ✅`vendor-recommendations` · priority support · boost **50 km**

### ⬢ ENTERPRISE — ₱7,499/28d · *scale as an org (bounded "larger range")*
**+** all categories · **up to 10 team seats** (extra seats **+₱250/28d** each — seat price owner-decided 2026-07-04; PR #2623 builds it) + multi-admin governance ✅`vendor-team` · shareable bid links · quarterly business review · contract intelligence 🔭 · priority dispute handling + account management · **reach up to 100 km** (owner re-capped 2026-07-04 — nationwide is sold in Custom, §11) · **up to 300 portfolio photos** · **up to 8 events per category**
_⚠ Enterprise is NO LONGER ∞ on these axes. Cap numbers **owner-confirmed 2026-07-01: 10 seats / 300 photos / 8 events per category.** `agentAccounts` is now the finite **10** in code (`vendor-tier-caps.ts`); extra seats beyond 10 are a **+₱500/28d** paid add-on (owner 2026-07-02 · billing flow pending)._
> **All tier caps are MAXIMUM CEILINGS, not defaults** (owner 2026-07-01). A higher tier only *raises the limit* — the vendor operates below it by choice; nothing is forced. The events cap is scoped **per category** (⚠ code's current axis is `slotsPerDay` = per-day; dashboard to reconcile "events per category" vs the per-day slot model when wiring).

### ✦ CUSTOM — "Talk to us" (negotiated · from ₱8,999/28d)
For franchises and chains beyond Enterprise caps: **more branches · more seats · more capacity**, plus a dedicated account manager. Composed as **Enterprise + ₱999 branches + overflow units + white-glove** (owner 2026-07-03). Multi-brand houses are NOT a Custom composition — one vendor account per brand. **Quotes are computed from the §11 rate card (numbers partially owner-decided; remainder pending sign-off), not invented per deal.**

---

## 3 · Copy corrections already applied to `/for-vendors`

- Crew "Coming soon" → live **Manpower marketplace** (module shipped).
- **"AI Proposal Builder" / "AI proposal drafting"** → **"Advanced Proposal Drafting"** (Pro) + new **"Proposal builder · templates + merge tokens"** Solo row (the real zero-LLM feature). Fixed in `vendor-hero`, `vendor-pricing-matrix`, `page.tsx` JSON-LD, `vendor-worth-it`.
- Hero no longer lists "AI matchmaking" as a Pro unlock (matching is a baseline).
- Free tier re-introduced as the 4th matrix column (reverses the 2027-02-18 drop).

---

## 4 · Open decisions / to-verify

1. **Solo linchpin — RESOLVED by §6 audit: FALSE in code.** `solo.inAppGated=true` → Solo burns tokens like Pro/Ent. Owner decides: (a) re-pitch Solo as "unlimited volume + real name day-1 + 3 services/category" (recommended — matches shipped code), or (b) set `solo.inAppGated=false` to make it token-free. Until decided, do **not** ship "Solo = no tokens" copy.
2. **Price — RESOLVED (owner 2026-07-01): Ladder B canonical, Ladder A DELETED.** **Solo ₱999 · Pro ₱2,499 · Enterprise ₱4,999 / 28d** (annual ₱9,999 / ₱24,999 / ₱49,999). Ladder A (₱2,000/₱6,000/₱10,000) is dead — remove it everywhere. **Code cleanup owed (dashboard session):** the `TIER_PRICE_PHP` fallback constant + any seed migration still carry Ladder A → reprice to Ladder B, and confirm the live `vendor_billing_catalog` already reads Ladder B (per memory it was repriced 2026-06-29). Dashboard reads `getVendorPrices` (never hardcode).
3. **Solo has zero uplift over Verified** on portfolio (50=50), slots (1=1), radius (20=20) — monotonic but flat. Owner: bump one axis for Solo or lean the pitch on volume + real-name.
4. **Verification pass — DONE** (§6). Remaining roadmap items must not be published as live: see §6 "ROADMAP".
5. Rebuild `/for-vendors` to the **benefits-forward, Free-in-the-spotlight** structure using §6 as the tier truth (still pending).

---

## 5 · Cross-session handoff log

_Append a dated entry whenever you change something the other session relies on._

- **2026-07-01 · marketing session** — created this doc; captured the full tier allocation + 88-benefit catalog + naming decisions. Applied the `/for-vendors` copy corrections in §3. **For the dashboard session:** the tier→feature gates in §2 are the intended entitlement map — when you wire `vendor-tier-caps`/entitlement checks, mirror the "starts at" tiers here, and flag back any surface whose real gate differs so we reconcile. The Solo "unlimited answering" linchpin (§4.1) is still owner-unconfirmed — don't hard-code it yet.
- **2026-07-01 · dashboard session** — read the doc; will mirror §2 "starts at" in `vendor-tier-caps` when gates are wired (currently PROTOTYPE only — no real gate wired yet, so nothing to commit; will append concrete gate values in the gate-wiring PR). **Acknowledged the Solo "unlimited answering" linchpin (§4.1) — NOT hard-coded.** New dashboard-side rules for the marketing session to reconcile against §2 when gates land:
  1. **No double-booking (per-date capacity).** Accepting an inquiry is blocked when a date is at capacity. Capacity is **tier-gated via the doc's "multiple events/day" (Pro) perk** → **Free/Solo = 1 booking/date; Pro/Enterprise = multiple/date.** (Suggest adding an explicit "bookings per date" row to §2 so both sides read one number.)
  2. **Waitlist replaces the booking inquiry when a date is full.** Couples can't inquire-to-book a full date (would double-book); the CTA becomes **Join waitlist**, and the top of the waitlist is promoted if the booking cancels. Couples can still inquire for the vendor's *other* open dates. **Proposed: waitlisting is free (no token burn); the region-band token burns only on conversion to a real booking** — owner to confirm.
  3. **Provisional numeric caps explored in the dashboard prototype** (branch = Pro+ ✓ matches §2; **per-account service ceilings 5/10/∞** and **accounts-per-tier 1/2/10** were owner-side numbers that EXTEND the doc's benefit framing) — **not locked**; the §2 benefit allocation stays authoritative until the owner ratifies numbers. Flagging so we don't publish caps the code won't enforce.
- **2026-07-01 · marketing session — ⚠️ BASELINE ALERT (read before trusting anything below).** The shared working tree `~/apps/web` is **464 commits behind `origin/main`** (HEAD `cdfb98277`). My earlier code reads, the `/for-vendors` copy edits in §3, AND a 95-verdict verification audit were all run against this **stale** tree → treat every "verified/absent/roadmap" verdict as **UNTRUSTWORTHY**. Concretely: the audit called vendor-import (#2448–2453) and multi-admin governance (#2472/#2473) "absent," but both are **merged on `origin/main`**. Even the `TIER_CAPS` values (prices, `solo.inAppGated`, monotonicity) may have changed across those 464 commits. **Precondition for real sync: update `~/apps/web` to `origin/main`, THEN re-run the audit.** Acknowledged the dashboard session's booking-capacity + waitlist rules above — will reconcile into §2 (incl. a "bookings per date" row) *after* re-baseline. **Do not wire gates or publish tier claims off the stale values.**
- **2026-07-01 · marketing session — RE-BASELINED + verification audit landed (§6 rewritten against origin/main HEAD `3dec2cb`).** Re-ran the 85-verdict audit in a clean `origin/main` worktree. **§6 is now the as-built tier truth** — use it, not §2's intended map, when wiring gates. Headlines for the dashboard session: (1) **Solo "no tokens" is FALSE** — `solo.inAppGated=true`; owner must re-pitch or re-gate (§4.1). (2) **Price unresolved** — migrations/fallback say ₱2,000/6,000/10,000, comment+memory say ₱999/2,499/4,999; **confirm live `vendor_billing_catalog`** before any price copy (§4.2). (3) Old "Solo < Free" monotonicity bug is **FIXED** (verified nerfed to 1 cat/0 seats) — do not re-report. (4) **Real code bug to file:** `vendor-cards.ts` `PAID_TIERS` excludes Solo from day-1 name reveal, contradicting `solo.nameMode='true'` — derive `isPaidTier` from `tierCaps(tier).nameMode`. (5) Dead cap `editorialTagged` (unenforced); dormant cap `marketplaceSearchable` (env-flag OFF → free vendors still searchable). (6) **Confirmed merged** (earlier stale audit was wrong): free import CRM #2448-2453 + multi-admin governance #2472/#2473. (7) **Add the 3 shipped analytics surfaces** to the benefit list: Demand Radar (`/demand`), Vendor funnel (`/funnel`), Price-position card. (8) "Read files in thread"/file-sharing is **not built** — help copy overstates it. Your booking-capacity + waitlist rules are noted and consistent with §6's `slotsPerDay` gating — will fold into §2 next pass.
- **2026-07-01 · dashboard session — RECONCILED to your re-baselined §6.** Adopted §6 as the as-built tier truth in the dashboard build plan (`~/Documents/Claude/Projects/Setnayan/03_Strategy/Vendor_Dashboard_Build_Plan_2026-07-01.md` §0.6). Concretely: (1) **dropped our provisional caps** — the prototype's "accounts 1/2/10" + "services-per-account 5/10/∞" are unratified owner numbers; the build plan now targets your **agentAccounts solo0/pro3/ent∞** + **servicesPerLeaf solo3/pro5/ent∞** + **branches Enterprise-only**. (2) **No-double-booking maps onto `slotsPerDay`** (free0/verified1/solo1/pro3/ent∞) — that's the capacity axis, confirmed. (3) **Solo linchpin left un-hard-coded** — no "Solo = no tokens" copy; Solo burns tokens per `inAppGated=true`. (4) **Decision B closed** — noted import is now FREE both ways (`e95f77315`/`3d8973077`), so the verification gate no longer bricks the CRM. (5) **Price left OPEN** — prototype renders ₱999/2,499/4,999 (memory reprice) but flagged "confirm live `vendor_billing_catalog`; never hardcode." **Dashboard-side items for you to reconcile into §2/§6 when convenient:** (a) **app-vs-import ROI attribution** in My Performance is a NEW proposal (needs a source dimension on bookings — Setnayan-sourced vs imported) not yet in code; (b) our **Messenger info-panel "shared files"** is design-only — consistent with your "file sharing NOT built" verdict; (c) **6th menu "On the Day"** (category-conditional day-of console; coordinator command center) is a free surface added to the dashboard IA; (d) **waitlist-instead-of-inquiry when a date is at `slotsPerDay`** — proposed free, token burns on conversion. Nothing committed (prototype only; local `~/apps/web` still behind origin/main — no gate wired).
- **2026-07-01 · marketing session — PRICE DECIDED (owner): Ladder B only, Ladder A deleted.** Canonical vendor subs = **Solo ₱999 · Pro ₱2,499 · Enterprise ₱4,999 / 28d** (annual ₱9,999 / ₱24,999 / ₱49,999). Ladder A (₱2,000/6,000/10,000) is dead everywhere — §4.2 + §6 blocker #2 updated to resolved. **Dashboard session action:** purge Ladder A from code — reprice the `TIER_PRICE_PHP` fallback constant to Ladder B and drop/replace any seed migration still seeding ₱2,000/6,000/10,000; confirm the live `vendor_billing_catalog` already reads Ladder B (memory says repriced 2026-06-29). Keep reading `getVendorPrices` (never hardcode). Value-vs-price rationale for the ladder is in the marketing session's response (one-booking-covers-the-year math holds at Ladder B; would break at Ladder A). Noted your dashboard-side additions (app-vs-import ROI attribution, "On the Day" 6th menu, waitlist-on-full) — will fold into §2 on the next benefits-forward pass.
- **2026-07-01 · marketing session — ENTERPRISE repriced ₱4,999 → ₱7,499 + made BOUNDED; new CUSTOM tier added (owner).** Enterprise is now a **bounded "larger range," NOT `Infinity`.** Owner-confirmed caps (2026-07-01), **all MAXIMUM CEILINGS not defaults** (higher tier only raises the limit): all categories · **10 seats · nationwide reach · 300 portfolio photos · 8 events per category**. ⚠ "events per category" — reconcile with the code's per-day `slotsPerDay` axis when wiring. A new **Custom "Talk to us"** tier (~₱15,000+/28d, negotiated / per-location) sits above for franchises / multi-location / truly-unlimited. **Dashboard session actions:** (1) reprice Enterprise DB → **₱7,499/28d** (annual ₱74,999); (2) change Enterprise `TIER_CAPS` from `Infinity` → the finite numbers above for `agentAccounts` (10), `serviceRadiusKm` (nationwide/large), `portfolioPhotos` (~300), `slotsPerDay` (~8) — leave `parentCategories` = all (taxonomy-bounded) + governance/reviews/editorial as-is; (3) add a **Custom** path (new `tier_state` OR admin custom-catalog/comp) for the unlimited case. **Cap numbers are owner-confirmed (10/300/8 + nationwide) — wire as-is.** Full ladder now: Free-Verified ₱0 · Solo ₱999 · Pro ₱2,499 · Enterprise ₱7,499 · Custom (contact).

- **2026-07-01 · marketing session — HYBRID GATING DECIDED (owner) + full-catalog re-tag SHIPPED.** After a full-catalog reconcile (all ~93 §2 benefits verified against §6, not the 60-dedup), the audit's headline landed: **the paid tiers barely gate anything — most Solo/Pro benefits are built but sit at `verified`, so a free vendor already gets them.** Owner picked **HYBRID**: gate the premium few, keep the ops spine free. The homepage overlay (`app/_components/home/vendor-benefits.ts` + `HomeOverlays.tsx` legend/count) is re-tagged to match — **44 Free · 4 Solo · 12 Pro** (Enterprise reads as cap-expansion in the legend), count corrected **41→42 live**. **⛔ CODE-OWED GATE LIST for the dashboard session (wire these; do NOT touch the free ops spine):**
  1. **Gate to Pro** — `Demand Radar` (`/vendor-dashboard/demand`, currently ungated role owner/admin) → require pro.
  2. **Gate to Pro** — `Reverse-Image Theft Watch` (`/vendor-dashboard/theft-watch`, PR #2489, currently ungated) → require pro.
  3. **Gate to Pro** — Category benchmarks / conversion-vs-peers (when built) → pro. Also **revive the DEAD `editorialTagged` cap** so Real Stories tagging actually pro-gates (§6 notes it's read nowhere).
  4. **Gate to Solo** — Performance **trends / funnel time-series** (vendor funnel `/funnel`, win-loss, peso-per-lead, reply-rate trends) → require solo+. The snapshot Performance panel stays free.
  5. **Scope to plan context** — `Boost radius (Local)`, `7-day boosters`, `Token packs` are ungated buy-anything primitives → bind to the vendor's active plan (not a leak, but should read as plan-scoped).
  6. **Split** — `Custom slug + Bid Button`: keep the slug pro-gated (`customWebsiteName`, live); hold the **Bid Button behind its roadmap flag** so it doesn't read as delivered.
  7. **Copy/build hygiene** — "Read files in-thread" (free) + "File sharing with couples" (solo) are **NOT built** (only help-copy claims them) → pull the claim or build attachments. And **align portfolio copy to code** (free cap is 30 not 10; Enterprise is ∞ vs the 300 plan cap — code is more generous).
  - **KEEP FREE for every verified vendor (owner-locked — do NOT gate):** CRM, in-app contracts + e-sign, earnings, recaps, mood-board preview, bookings pipeline, payment schedules, proposal builder, full portfolio, .ics export, plus all discovery/trust/microsite. **Solo earns ₱999 on what code already enforces** — unlimited weekly inbound (verified 10/wk → solo ∞) + performance trends (once gated) + `servicesPerLeaf` 3. **No token-model change needed** (`solo.inAppGated` stays true; §4.1 linchpin is re-pitched as volume+trends, not "no tokens").

- **2026-07-01 · marketing session — HYBRID GATES WIRED (3 of the premium-few) — PR (vendor-hybrid-gate-wiring).** Did the top of the code-owed list above. **New caps in `vendor-tier-caps.ts`:** `marketIntel` (Pro+), `theftWatch` (Pro+), `performanceTrends` (Solo+) on all 5 tiers, monotonic; `canSeeMarketIntel/TheftWatch/PerformanceTrends()` helpers. **New `lib/vendor-feature-gate.ts`:** `isVendorFeatureGateEnabled()` (env `VENDOR_TIER_FEATURE_GATE`) + `resolveVendorTier()` (targeted `tier_state` read — deliberately NOT added to the shared `FULL_VENDOR_PROFILE_SELECT`). **Enforced at 3 surfaces** with a shared `VendorTierGate` upsell panel (`app/vendor-dashboard/_components/tier-gate.tsx`, points at `/vendor-dashboard/subscription`): `/demand`→Pro, `/theft-watch`→Pro, `/funnel`→Solo. **⚠ FLAG-DARK by design** (mirrors `vendor-search-gate.ts`): the flag defaults OFF so the founder + every demo/test vendor (all `tier_state='free'` today) aren't locked out. **Behaviour is unchanged until the owner sets `VENDOR_TIER_FEATURE_GATE=true` in prod once paid vendors exist** — flipping that one env var activates all 3 gates (upsell panels) at once. **STILL OWED (dashboard/admin session):** wire the existing-but-DEAD `editorialTagged` cap so Real Stories tagging pro-gates (admin curation surface); scope boost-radius/boosters/token-packs to plan context; split Custom-slug (live) from Bid-Button (roadmap flag); pull the unbuilt "read files in-thread"/"file sharing" copy; align portfolio-cap copy to code (30 free / ∞ ent vs plan 10/300).

- **2026-07-01 · marketing session — SOLO BEEF-UP + editorial cap wired (owner "also beef up Solo") — PR (vendor-solo-beefup-plus-owed).** Solo was thin (only unlimited answering + funnel trends + 3 services separated it from verified). Owner chose to give it real weight, accepting the trade of moving 2 now-free surfaces to Solo-exclusive. **(1) Solo beef-up:** new cap `soloBusinessTools` (Solo+, monotonic) + `canUseSoloBusinessTools()`; gated **`/vendor-dashboard/earnings` and `/vendor-dashboard/recaps` → Solo** (same flag-dark pattern, `VendorTierGate` upsell). Deliberately did NOT gate bookings-pipeline (core get-booked flow) or anything in the discovery/trust spine. **(2) Editorial cap REVIVED (owed #1 done):** the `editorialTagged` cap was "dead" only because the display hardcoded `tier === 'pro' || 'enterprise'` — refactored `lib/showcase-db.ts` + `app/[slug]/_components/editorial/data.ts` to read `tierCaps(tier).editorialTagged` instead. **Zero behaviour change** (`editorialTagged` ≡ pro/ent) — it just makes the cap non-dead + fixes a latent `solo`-omission in the editorial tier union (solo now correctly = plain credit, not tagged). Verified/Solo still get a plain text credit; Pro/Enterprise get the tagged showcase (logo + badge + link). NOT flag-guarded (behaviour-preserving refactor). **(3) Bid Button (owed #2):** confirmed ROADMAP-ONLY — zero code references; the custom slug is already Pro-gated via `customWebsiteName`. Nothing to split in code; keep it labelled "soon" in marketing. **STILL OWED (smaller · dashboard/admin session):** scope boost-radius/boosters/token-packs to plan context; pull the unbuilt "read files in-thread"/"file sharing" copy; align portfolio-cap copy to code. **Solo now earns ₱999 on:** unlimited weekly inbound (∞ vs 10/wk) + funnel trends + earnings analytics + recap sharing + 3 services/category. All new gates activate together when `VENDOR_TIER_FEATURE_GATE=true`.

- **2026-07-01 · marketing session — cleanup batch ASSESSED (most were non-issues) — PR (vendor-tier-copy-cleanup).** Ran down the remaining §5 cleanup items; the product code was already clean, so this is mostly an honesty/SSOT pass, not fixes: **(a) Boost-radius/boosters/token-packs "scope to plan" — NO code gap.** Token buying is already verification-gated (server-authoritative `NOT_VERIFIED` raise in `tokens/actions.ts` + `canBuyTokens` = tier≠free); boost-radius is a tier CAP (`serviceRadiusKm`), not a purchasable primitive; there is no ungated "7-day booster" purchase (the only "booster" refs are code comments). Nothing to gate. **(b) Portfolio "up to 10" copy — NO shipped over-claim.** The "10" only lived in this doc's plan text; no for-vendors/overlay surface states a 10-photo cap (code = 30 free / 50 verified-solo / 100 pro / 300 ent). Nothing to fix. **(c) "read files in-thread" / file-sharing over-claim — the only real one, and it's NOT code.** Thread file-attachments aren't built; the claim lives in the DB-driven Help articles (admin-managed content) + this doc's §2 (now struck, above). ⛔ **OWNER/ADMIN action:** edit the Help article that claims in-thread file reading/sharing — it's not in the repo, so no code PR can fix it. **(d) Bonus hygiene:** `app/for-vendors/_components/page-tail.tsx` FAQ carried a DEAD static default with stale Ladder-A prices (₱6,000/₱10,000) — the live FAQ overrides it with DB-driven `getVendorPrices`, so the page was correct, but the stale hardcode was a landmine → stripped the numbers, point to `/pricing`. **Net: no live product bug found; SSOT + one dead hardcode cleaned; one admin help-article edit outstanding.**

- **2026-07-01 · marketing session — "For vendors" pop-up REORGANIZED BY ACCOUNT TYPE (owner) — PR (vendor-overlay-by-tier).** Owner: "I thought you'd organize it depending on the type of account, from free to enterprise." The homepage overlay was thematic (7 groups: Discovery/Booking/Money/… with a tier chip per benefit); restructured to **tier sections Free → Solo → Pro → Enterprise → Custom**, each showing what it ADDS (matches the /for-vendors ladder + the widget the owner approved). `app/_components/home/vendor-benefits.ts` rewritten from `VENDOR_GROUPS`/`VENDOR_HERO_CARDS` (thematic) → `VENDOR_TIER_SECTIONS` + `VENDOR_CUSTOM_TIER` (Free sub-grouped by theme so its ~45 items stay scannable; Solo/Pro/Enterprise flat). `HomeOverlays.tsx` renders coloured tier bands (Free grey / Solo sage / Pro gold / Enterprise violet / Custom dark) via new `hr-vt-*` CSS. Tier assignments unchanged from the hybrid decision (this is a re-org, not a re-tag); tier chips retired in favour of the section headers. Supersedes the "60 distinct benefits · tier-chip" overlay in §7.
- **2026-07-03 · dashboard session — PUBLIC-PAGE (WEBSITE) TIER LADDER shipped + documented per tier (owner "place what they get for the website").** The `/v/[slug]` public page + My Shop → Website editor now render a **different output per tier**, each inheriting the one below. Gates: `tierCaps.customWebsiteName` (Pro+) for the premium layer, `micrositeCan(tier)` (`canPersonalize` = Solo+, `isEnterprise`) for the rest — rank-derived, NOT new `TIER_CAPS` rows, so the §6 table is unchanged. As-built ladder:
  - **Free · Verified → "Listed":** the auto-composed, search-ready public page (no personalization controls). *(This is the existing free "profile + microsite".)*
  - **Solo → "Personalized":** + About intro · accent colour (6 curated presets) · featured services (≤3, floated first) · section show/hide toggles.
  - **Pro → "Premium":** + the 2-column layout with a sticky "Inquire" rail · custom bare-root URL (`/your-name`) · hero photo · pinned review · featured Real Stories (editorials, ≤3).
  - **Enterprise → "Flagship":** + a cinematic name-over-photo hero · a **"Films" video portfolio** — YouTube links that play on the page (youtube-nocookie, ≤6; migration `20270505905788` `microsite_video_ids`).
  - **Lifecycle:** downgrade/lapse REVERTS the page to the tier baseline but KEEPS the stored data (soft hide → re-upgrade restores instantly); the custom URL is not reverted (shared permalink). PRs #2653/#2658/#2661/#2672/#2700/#2708. Vendor-facing copy added per tier in `app/_components/home/vendor-benefits.ts`. **⚠ Enterprise-only video is an owner-adjustable tier call** (flip to Pro+ by moving the field to the Pro set).

---

- **2026-07-03 · strategy session — CUSTOM TIER RATE CARD proposed (new §11).** Custom moves from "contact prompt with nothing behind it" to a quotable formula: **base ₱14,999/28d incl. 3 fully-loaded locations · +₱2,499/location · +₱1,999/brand · overflow units (seat / event-slot ₱499 / photos ₱99) · charm-round up · annual = 10×28d.** Model = "per-location Enterprise." All numbers PROPOSED — 6 sign-off items listed in §11; do not publish or wire until the owner signs. **Also flagged in §10: seat-price conflict** — open PR #2623 implements ₱250/28d while §10 records ₱500/28d for the same owner decision; needs one number before #2623 merges. **Dashboard session:** no action yet; after sign-off the Stage-2 quote builder brief lands (org-scoped `vendor_billing_catalog` row + `tier_state='custom'` + composition-driven caps).

- **2026-07-03 · strategy session — CUSTOM RATE CARD REVISED per owner (2 decisions).** (1) **Branch = ₱999/28d listing-only, shared cap pool** — the v1 "fully-loaded ₱2,499 location with its own Enterprise caps" unit is DELETED; franchises scale caps via overflow units. Also settles the old Pricing.md § 0.C ₱999-vs-₱1,000 branch flag → ₱999. (2) **"Additional brand" line DROPPED** — multi-brand houses register one vendor account per brand. §11 model line, table, examples, and sign-off list rewritten; §2 Custom card updated. Remaining sign-offs: base composition (₱14,999 incl. 3 branches) · extra-seat ₱250 vs ₱500 · overflow unit prices · annual/token treatment.

- **2026-07-04 · strategy session — CUSTOM CONFIGURATOR = SLIDERS ON BOTH SIDES (owner).** §11 Stage 2 rewritten: the Custom composer is a **two-surface slider configurator**, not an admin-only quote tool — vendors move the line sliders themselves on `/vendor-dashboard/subscription` (live charm-rounded price, floored at base, 28d/annual toggle, submit → apply-then-pay + admin review handshake) and HQ admin has the same sliders per org plus unit-price control via the admin catalog. Provisioning = `tier_state='custom'` + effective caps = base + purchased units. Interactive prototype delivered to the owner for the remaining 4 number sign-offs. **Dashboard session:** no action until sign-off; the Opus build brief will cover both surfaces.

- **2026-07-04 · strategy session — CUSTOM BASE REPRICED ₱14,999 → ₱8,999, LEAN (owner: "shouldn't custom start a bit above enterprise?").** Base = Enterprise ₱7,499 + ₱1,500 white-glove premium (account manager · QBR · priority disputes · negotiated onboarding); main address included, NO bundled extra branches — every additional branch is +₱999 from the 2nd. Kills the dead zone between Enterprise ₱7,499 and the old ₱14,999 floor; supersedes the 2026-07-01 "~₱15,000" number. New worked example: 5-branch franchise = **₱12,999/28d · ₱129,999/yr**. §11 table/formula/examples + §2 Custom card updated; sign-off prototype re-published with the new base. Remaining sign-offs (3): extra-seat ₱250 vs ₱500 · overflow units (slot ₱499 / photos ₱99) · annual + token treatment.

- **2026-07-04 · strategy session — REACH (km) LINE added to the Custom rate card (owner: "KM reach also add that").** New §11 line: **+₱499 per +100 km · Nationwide flat +₱2,499**, 100 km included in the base; added as the second slider in the configurator prototype (100→500 km steps, Nationwide at the top). **⚠ Surfaced a load-bearing contradiction:** Enterprise's 2026-07-01 owner cap says "nationwide reach," which would make a paid reach line meaningless — but §6's code note markets Enterprise at 100 km and §1's boost ladder ends at 100 km. Owner must pick (sign-off item 4): re-cap Enterprise at 100 km, or keep nationwide and drop the line. §2 Enterprise copy untouched pending that call.

- **2026-07-04 · strategy session — CUSTOM RATE CARD FULLY SIGNED (owner, all 5 remaining items).** Decisions: **Enterprise reach = 100 km** (supersedes the 2026-07-01 "nationwide" cap; reach beyond 100 km = Custom revenue at +₱499/100km · nationwide +₱2,499) · **extra seat ₱250** (the §10 ₱500 figure is dead; **PR #2623 auto-merge armed, merges as-is**) · slot ₱499 / photos ₱99 approved · annual = 10×28d + per-answer tokens confirmed. §2 Enterprise updated (reach up to 100 km; seat add-on ₱250). **Dashboard session actions:** merge #2623 · `TIER_CAPS` enterprise `serviceRadiusKm` ∞→100 · sweep public copy for Enterprise "nationwide" claims · Stage-2 configurator build is GO (Opus brief after #2623 + this PR land).

- **2026-07-04 · strategy session — TWO LINES ADDED to the signed Custom card (owner: "okay add them. monthly tokens.").** (1) **Included tokens per cycle at flat ₱100 each** — bundled face-value prepay ("monthly" = per 28-day cycle per the month-lock), explicitly NOT a bulk discount; configurator slider 0–500 step 25. (2) **Custom domain +₱499/cycle** — vendor's own domain on their Setnayan website; ⚠ depends on the slug-program custom-domains build (pending) — becomes its first funded use case. Also discussed-and-parked: recurring boost slots (add when a prospect asks) + quarterly market-intel report + one-time onboarding line (needs one-time-vs-recurring support in the configurator). **Never-sell guardrails restated: no paid ranking/matching priority (merit-only lock) · no paid verification/badges · no storage-as-profit.** Prototype re-published with both sliders.

- **2026-07-04 · strategy session — HQ DISCOUNT + QUOTE-CONTENTS spec added to Stage 2 (owner).** (1) Admin can apply a per-org **discount as amount (₱) or rate (%)** per cycle — applied to the charm-rounded list, re-charmed, annual = 10× discounted; admin-only, surfaced on the vendor quote as an explicit partner-discount line. (2) **Quote leads with the composition** ("they will see what they get for this price") — benefits itemized in plain words before the price; same composition in the payment-instructions email + acceptance screen. Prototype re-published: HQ discount control (₱/% chips + input, live in the breakdown) and "Send quote" now renders the vendor-facing quote preview.

## 6 · Verification audit (2026-07-01 · origin/main HEAD `3dec2cb`)

Source of truth: coded `apps/web/lib/vendor-tier-caps.ts` + DB `vendor_billing_catalog`. **Where §6 disagrees with §2's intended allocation, §6 is the as-built reality.** 85 per-benefit verdicts reconciled. `TIER_CAPS` is real, single-source, enforced by 26 importers (services/actions, calendar/actions, team/actions, vendor-dashboard/actions, chat-send, proposal-send). Ladder was retuned 2026-06-25 → strictly monotonic Free < Verified < Solo.

### Real TIER_CAPS (SSOT)
| axis | free | verified ("Free") | solo | pro | enterprise |
|---|---|---|---|---|---|
| serviceRadiusKm | 0 | 20 | **20** | 50 | ∞ (marketed 100km) |
| servicesPerLeaf | 2 | 2 | **3** | 5 | ∞ |
| parentCategories | 1 | 1 | 1 | 3 | ∞ |
| agentAccounts | 0 | 0 | 0 | 3 | ∞ |
| portfolioPhotos | 30 | 50 | **50** | 100 | ∞ |
| slotsPerDay | 0 | 1 | **1** | 3 | ∞ (time-bound = ENT-only) |
| inAppCustomers/wk | 0 | 10 | **∞** | ∞ | ∞ |
| inAppGated (token burn) | false | **true** | **true** | true | true |
| nameMode | hidden | screen | **true** | true | true |
| reviewCommentsViewable | no | no | no | **yes** | yes |
| editorialTagged | no | no | no | yes (DEAD cap) | yes |
| customWebsiteName (slug) | no | no | no | yes | yes |
| marketplaceSearchable | no (gate DORMANT) | yes | yes | yes | yes |

### 🟢 Verified-built (ship these)
Discovery (matched search · leaf-match · no-reviews-neutral · hidden-until-reply · shortlist · precision attributes · verified 10/wk unlocks) · credibility (verified badge · profile+microsite · star ratings + reviews carousel · earned badges · experience-tier badge · recommended-by-N · **Bayesian rating**) · **bring-your-business: free import CRM #2448-2453 (cost 0), claim-QR, verified-wedding pills — MERGED on HEAD** · close (pipeline · reply-speed rank · set-price · payment-options · notifications · email alerts · availability · control-visibility · own-performance panel · song bank music-gated) · exposure (credited-to-guests · appear-in-planner+budget) · Pro (3 cats + 3 seats · custom slug · full reviews · multi-event/day) · Enterprise (all cats · unlimited team + **multi-admin governance voting #2472/#2473, wired**) · cross-cutting (0% commission structural · no EWT/2307 · logo+name-mask in chat · event-types-unlock · merit-only ranking · **DB price authoritative via getVendorPrices**).

### 🆕 Shipped analytics surfaces the doc never listed (add them)
- **Demand Radar** (`/vendor-dashboard/demand`, `demand_radar_for_vendor` RPC) — this IS "demand pulse", shipped + **ungated** (role owner/admin), over-delivered vs the Pro intent.
- **Vendor funnel** (folded into `/vendor-dashboard/performance` · 2026-07-02, `lib/vendor-funnel.ts`; the standalone `/vendor-dashboard/funnel` route now redirects there) — real views→inquiries→quotes→booked with time-over-time deltas (not vs-peers), plus the "where your bookings/views come from" by-source breakdown (also surfaced as an own-data strip on Demand Radar).
- **Price-position card** (`lib/price-position.ts`) — market_price_bands percentile (price-only, min-N floored). These three partially deliver "benchmarks/conversion" — but as **time-over-time / percentile**, not the doc's promised **vs-peers** comparison.

### 🟠 Thin / mis-tiered (correct the marker)
- **editorialTagged cap is DEAD** — declared, read nowhere → Real Stories tagging is effectively all-tier, not Pro-gated.
- **marketplaceSearchable dormant** — behind env `VENDOR_TIER_SEARCH_GATE` (default OFF, zero call sites) → free vendors are NOT excluded from search today.
- **`vendor-cards.ts` PAID_TIERS={pro,enterprise} excludes Solo** from day-1 name reveal, contradicting `solo.nameMode='true'`. **Code fix:** derive `isPaidTier` from `tierCaps(tier).nameMode==='true'`.
- Performance = snapshot only (no time-series). Category-benchmarks/conversion-vs-peers = placeholder/time-over-time only. Pre-qualified inquiries = standard inbox. Review-on-import = provenance tag only. Coordinator-per-thread = couple-side delegation only.
- ~~**Reverse-image theft-watch** engine is real but **admin-only** — no vendor-facing surface.~~ **RESOLVED (PR #2489)** — vendor-facing surface now shipped at `/vendor-dashboard/theft-watch` (see §9).
- **"Read files in thread" / file sharing NOT built** — only help-copy claims it. Pull the claim or build attachments.
- Most "Solo unlocks" in §2 (portfolio · bookable slots · .ics/hybrid · proposal builder · CRM · earnings · contracts · mood board · recaps · bookings · payment-schedules) are actually **Verified-or-ungated**, NOT Solo-exclusive. Branches = **Enterprise** (not Pro). Same-day = **Verified+** (not Pro). Redeem-codes + Manpower = **verification-gated**.

### 🔭 Roadmap / marketing-only (do NOT surface as live)
Hand-curated ops intros · Advanced Proposal Drafting · onboarding bundle maker · specialized toolkits · co-listing w/ Productions · Bid Button · shareable bid links · vendor referrals (Partnerships is the adjacent ungated V2V surface) · priority support · QBR · contract intelligence (retired 2026-05-18).

### ⛔ Owner-decision blockers (before the dashboard build)
1. **Solo linchpin FALSE** — `solo.inAppGated=true`, Solo burns tokens. Re-pitch (recommended) or set `inAppGated=false`. No "Solo = no tokens" copy until resolved.
2. **Price — RESOLVED (owner 2026-07-01): Ladder B canonical** = Solo ₱999 / Pro ₱2,499 / Ent ₱4,999 / 28d (annual ₱9,999 / ₱24,999 / ₱49,999). **Ladder A (₱2,000/6,000/10,000) DELETED.** Dashboard: purge Ladder A from the `TIER_PRICE_PHP` fallback + reprice migration; confirm live DB = Ladder B.
3. **Solo flat vs Verified** on portfolio/slots/radius — bump one axis or lean the pitch on volume + real-name + servicesPerLeaf 3.

---

## 7 · Benefit-catalog sync (2026-07-01)

The homepage "For vendors" overlay (`app/_components/home/vendor-benefits.ts`) was **out of sync** — it had ~45 benefits ported from `03_Strategy/Vendor_Benefits_Catalog_2026-06-29.md` (50), while this doc's §2/§6 had ~88, and the union was 100+. Reconciled via a 7-lens merge + per-benefit code verification into **ONE catalog: 60 distinct benefits · 41 live · 19 soon** (honest dedup — no padding; the "100+" was inflated by cross-tier repeats + caps counted as benefits). The overlay is now generated from that verified set; its `soon` flags match §6.

**This doc's §6 is the SSOT.** When the dashboard session ships a benefit, update §6's status here → the overlay's `soon` clears in step. Homepage count banner now reads "60+ ways · 41 live today."

**Live-vs-soon by lens** (soon = not yet live end-to-end): Discovery 6/0 · Booking 8/4 · Money 7/0 · Trust 7/3 · Marketing 2/6 · Data 6/2 · Ecosystem 3/6. The heaviest remaining build is **Marketing/editorial** (social auto-share, Real Stories/Journal features, awards, referrals) and **Ecosystem** (crew earn-a-cut, resell Productions, white-label, certified-partner) — those are the roadmap program if we want the SOON count to keep dropping.

---

## 9 · Wave-1 build log (2026-07-01)

- **✅ B · Profile score → Fix-It Tips — SHIPPED.** New pure builder `lib/vendor-profile-tips.ts` (`buildProfileTips`) turns the `vendor_activity_stats` components into a ranked, deterministic checklist (top drags on the quality score, concrete current→target + inquiry-lift framing; no ML). Replaced the old 3-condition inline `nudges` in `vendor-stats-panel.tsx` with a "Fix-it tips" card (hides when the score is strong). `Profile Score & Fix-It Tips` flipped `soon`→live (Data lens). Also **re-landed the stranded token-clear** — "Pay Only For Inquiries That Fit" was cleared in #2482 but auto-merge stranded that commit; re-cleared here. Counts now **40 live / 20 soon** (were mislabeled 36/25).
- **✅ A · Reverse-image theft-watch vendor surface — SHIPPED (PR #2489).** New `/vendor-dashboard/theft-watch` page + `lib/vendor-theft-watch.ts` (admin-client read of `vendor_image_flags` scoped to `source_vendor_id = session vendor`; reposter identity hidden on unconfirmed flags). Nav entry in My Shop (`ShieldAlert`, `lint:navicon` green). `Reverse-Image Theft Watch` flipped `soon`→live (Trust lens).
- **Both Wave-1 builds are now live** (A via #2489, B via #2487) → catalog **41 live / 19 soon**. Next SOON→LIVE candidates concentrate in Marketing/editorial (social auto-share, Real Stories/Journal, awards, referrals) + Ecosystem/crew (earn-a-cut, resell Productions, white-label, certified-partner).

## 10 · Team-seat ladder (owner 2026-07-02)

Final `agentAccounts` ladder (invitable teammates **on top of** the always-free owner/admin — enforcement in `team/actions.ts` counts only non-owner seats): **Free 0 · Free · Verified 0 · Solo 1 · Pro 3 · Enterprise 10.**

- **Shipped this PR:** `solo.agentAccounts` **0 → 1** in `vendor-tier-caps.ts` (Verified=0 and Enterprise=10 were already on `origin/main`). Enforcement + the subscription-card seat label + the Team invite guard all derive from `agentAccounts`, so they update automatically — no other code touched.
- **Pending (owner-specified, NOT built):** Enterprise-only **paid extra seats at +₱500/28d each** beyond the base 10. Needs a `vendor_billing_catalog` add-on SKU + a purchased-seat count + effective-cap wiring (`base + purchased`) + a Team "Add seat" CTA + admin reconcile — and a billing-lifecycle decision (co-terminate with the Enterprise sub vs. independent per-seat renewal; lapse behavior). Held for owner sign-off before build.
- ✅ **Seat-price conflict RESOLVED (owner 2026-07-04): ₱250/28d.** The ₱500 figure above is dead. **PR #2623 merges as-is** (auto-merge armed 2026-07-04); §11's rate card uses ₱250.

## 11 · Custom tier rate card (PROPOSED 2026-07-03 · owner sign-off pending)

> **Why:** companies ask for a custom tier and we have no way to hand them a price — the §2 Custom card is a contact prompt with nothing behind it. This section makes Custom **quotable in minutes, from a formula, not per-deal improvisation**. Stage 1 = quote by hand from this card; Stage 2 = HQ admin quote builder computes it (build brief goes out only after the numbers below are signed). All values are **provisional** per the admin-managed-pricing + holistic-review locks — the rate card defines the *structure*; amounts stay editable in the admin catalog.

**Model (REVISED 2026-07-03 · owner): Custom = Enterprise + branches + overflow units + white-glove.** A **branch is a listing** — another address / service area under the same business, **sharing the org's single cap pool**. Owner decisions 2026-07-03: **all branches ₱999/28d** (the v1 "fully-loaded ₱2,499 location with its own Enterprise caps" unit is **DELETED** — a franchise that needs more seats/photos/slots buys the overflow units, not pricier branches; this also settles the old ₱999-vs-₱1,000 branch flag from Pricing.md § 0.C → **₱999**), and the **"additional brand" line item is DROPPED** — a multi-brand house registers **one vendor account per brand**, each with its own subscription, reviews, and portfolio.

### Rate card (per 28 days · PHP)

| Component | Price/28d | What it includes |
|---|---|---|
| **Custom base** | **₱8,999** ✅ | Everything in Enterprise (main address included; no bundled extra branches) · dedicated account manager · quarterly business review · priority dispute handling · negotiated onboarding (**owner-decided 2026-07-04**: lean base = Enterprise ₱7,499 + ₱1,500 white-glove premium; the ₱14,999 "incl. 3 branches" base is DELETED — it created a dead zone above Enterprise) |
| Additional branch (2nd onward) | **+₱999** ✅ | Another address / service-area listing; shares the org's cap pool (**owner-decided 2026-07-03**) |
| Extended reach | **+₱499 per +100 km** · Nationwide flat **+₱2,499** ✅ | 100 km included in the base (**owner-decided 2026-07-04: Enterprise reach = 100 km**, superseding the 2026-07-01 "nationwide" cap — reach beyond 100 km is Custom revenue) |
| Extra seat (beyond the org's 10) | **+₱250** ✅ | Reuses the Enterprise extra-seat add-on (**owner-decided 2026-07-04** — the §10 ₱500 figure is dead; PR #2623 merges as-is) |
| +1 event slot per category | +₱499 | Capacity on the shared pool |
| +100 portfolio photos | +₱99 | Deliberately near-cost — storage is a retention convenience, **never a profit line** (tax-aware-floor lock) |
| Included tokens, per cycle | **+₱100 each** ✅ | Inquiry tokens bundled into every 28-day cycle at flat face value (**owner-added 2026-07-04**) — prepaid convenience for volume answering, NOT a discount (keeps the no-bulk-discount call intact). Configurator slider 0–500, step 25 |
| Custom domain | **+₱499** ✅ | Vendor's own domain (e.g. `yourbrand.ph`) pointing at their Setnayan website (**owner-added 2026-07-04**). ⚠ Build dependency: the slug-routing program's custom-domains work is still pending — this line gives it a paying customer |

### Quote formula

1. `raw = base + Σ(units)`
2. **Charm-round UP** to the next ‑99 ending (e.g. ₱19,997 → ₱19,999).
3. **Floor:** never below the ₱8,999 base (the white-glove premium is the point of Custom).
4. **Annual = 10 × the 28-day quote** — same 13-cycles-pay-10 (3 free cycles) math as the rest of the ladder. Annual-first sales motion for Custom.
5. **Tax-aware floor check** (`price ≥ (cost + margin) ÷ 0.663`): trivially cleared — branches/seats are pure-margin digital; the photo unit is the sole near-cost line and is priced as such on purpose.

### Worked examples

- **5-branch catering franchise (standard caps):** 8,999 + 4 × 999 = 12,995 → **₱12,999/28d · ₱129,999/yr**.
- **5-branch franchise scaling up** (30 seats · 600 photos): 12,995 + 20 × 250 + 3 × 99 = 18,292 → **₱18,299/28d** (seat line pending the ₱250/₱500 pick).
- **Single-brand studio needing 12 events/category + 400 photos:** NOT Custom — Enterprise 7,499 + 4 × 499 + 1 × 99 = 9,594 → **₱9,599/28d** as Enterprise + overflow units. (The same composition inside Custom = 8,999 + 4 × 499 + 99 = ₱11,099 — the ₱1,500 delta is the white-glove premium, as intended.)
- **5-branch franchise going nationwide:** 12,995 + 2,499 = 15,494 → **₱15,499/28d · ₱154,999/yr**.
- **Same franchise, full service** (+100 tokens/cycle + custom domain): 15,494 + 10,000 + 499 = 25,993 → **₱25,999/28d · ₱259,999/yr**.
- **Multi-brand house:** not a Custom composition — one vendor account per brand, each on its own tier (owner 2026-07-03).

### What Custom does NOT change

Token economy unchanged — Custom answers still burn region-banded tokens (₱100/200/300) like every answering tier; **no bulk-token discount in v1** (flag to owner if a prospect pushes). 0% commission, apply-then-pay rails, and admin-managed pricing all hold.

### Delivery mechanism (Stage 1 — manual, works today)

Admin computes the quote from this card → creates an org-scoped `vendor_billing_catalog` row (`custom_vendor_<org>` · 28d cadence · quoted amount) → payment-instructions email → apply-then-pay → set the org's Custom path (`tier_state='custom'` — the path §5's 2026-07-01 entry already assigns to the dashboard session) with caps matching the quoted composition. Renewals fold add-ons into one order (same pattern as the token-addon / seat fold-in renewals).

### Stage 2 — the slider configurator (owner-directed 2026-07-04 · build AFTER sign-off)

**Owner: "the customization will be vendor AND admin side — they can move the line sliders to meet their demand."** Not an admin-only quote tool; a two-surface configurator over the same rate card:

- **Vendor side (self-serve):** a "Build your Custom plan" panel on `/vendor-dashboard/subscription` — **one slider per rate-card line** (branches · reach in km, topping out at Nationwide · team seats · event slots per category · portfolio photo packs · included tokens per cycle · custom domain toggle), baselines pinned at what the base includes. Price recomputes **live** as sliders move (charm-rounded · floored at the base · 28d/annual toggle at 10×). Submitting creates the org-scoped apply-then-pay order with an **admin review handshake** before activation (same approval pattern as the STD-openings buy flow).
- **Admin side (HQ):** the same sliders scoped to any vendor org for negotiated deals, **plus unit-price control** — line prices live in the admin catalog (admin-managed-pricing lock) and the vendor's sliders read whatever admin set. Admin can also compose + send a quote directly (payment-instructions email).
- **Discount (owner 2026-07-04):** HQ can apply a per-org discount as an **amount (₱) or rate (%)** per cycle. Applied to the charm-rounded list price, re-charm-rounded after; annual = 10 × the discounted 28-day figure. Discount is admin-only (never a vendor-side control) and appears on the vendor's quote as an explicit "partner discount −₱X per cycle" line.
- **Quote contents (owner 2026-07-04): "when we send quote, they will see what they get for this price."** The quote the vendor receives leads with the **composition, not the number**: everything-in-Enterprise + white-glove trio, then each dialed line in plain words (N branches · reach · seats · slots per category · photos · tokens per cycle · domain), then the price block (28d + annual with the 3-free-cycles note), the discount line if any, and the standing assurances (0% commission · BDO/GCash · nothing charged until approval). Same composition renders in the payment-instructions email and on the acceptance screen.
- **Provisioning:** acceptance sets `tier_state='custom'` with effective caps = base + purchased units (same `effectiveSeatCap` composition pattern); renewals fold all units into one order.

Brief goes to an Opus implementation agent once the remaining sign-off numbers are locked.

### ✅ Rate card FULLY SIGNED (owner 2026-07-04)

All numbers locked (decision trail: 2026-07-03 branches/brand · 2026-07-04 base, reach, seat, units, billing):

- **Base ₱8,999/28d** — Enterprise + white-glove (account manager · QBR · priority disputes · negotiated onboarding); main address + 100 km reach included.
- **+₱999** per additional branch (2nd onward, listing-only, shared cap pool).
- **+₱499 per +100 km reach · Nationwide flat +₱2,499** — Enterprise re-capped at **100 km** (supersedes the 2026-07-01 "nationwide" cap).
- **+₱250** per extra seat (PR #2623 merges as-is; §10's ₱500 is dead).
- **+₱499** per +1 event slot/category · **+₱99** per +100 photos.
- **+₱100 per included token/cycle** (flat face value, no discount) · **+₱499** custom domain (**owner-added 2026-07-04**).
- **Annual = 10 × 28d** (13 cycles, 3 free) · tokens burn per answer like every tier, no bulk discount in v1.
- Charm-round UP to ‑99 · floor at base · prices admin-managed (the card is seeded values, not hardcoded).

**Dashboard-session / build actions unblocked by the sign-off:**
1. Merge #2623 (armed). 2. `TIER_CAPS` enterprise `serviceRadiusKm` ∞ → **100** (and sweep marketing copy for Enterprise "nationwide" claims — `/for-vendors`, pricing matrix, overlay). 3. Stage-2 configurator build (both surfaces per the Stage-2 spec above) — Opus brief goes out once #2623 + this PR land.
