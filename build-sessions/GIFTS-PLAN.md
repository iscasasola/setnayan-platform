# Gifts & Deals — G1 … G6

## ✅ COMPLETE — all six sessions merged, 2026-09-06. Nothing below is open.

**Do not run any session in this file.** Every one is shipped and on `origin/main`; the tables
and prompts are kept as the record of what was decided and why, not as work.

Verify in one command rather than trusting this line — a plan is not evidence, and this file
told a reader G3–G6 were pending for a full day after they merged:

```bash
git show origin/main:apps/web/lib/vendor-papic-portfolio-album.ts >/dev/null && echo G3   # PR #5267
git show origin/main:apps/web/lib/promo-free-windows.ts | grep -c vendorDealWindowsFor      # G4, PR #5211
git show origin/main:apps/web/lib/promo-free-windows.ts | grep -c coupleWindowCoversEvent   # G5, PR #5245
ls supabase/migrations/*vendor_tier_source_and_sku_comps.sql                                # G6, PR #5246
```

🪤 **THIS FILE IS ITS OWN CAUTIONARY TALE.** On 2026-09-06 a session read the un-struck G5 row,
believed it, and got one command from rebuilding a feature that had merged five hours earlier —
caught only by `gh pr list` on the branch name. The repo's own rule covers exactly this: grepping
`origin/main` answers *"does this ship"*, never *"is somebody building this right now"*. **A
handoff decays fastest exactly where it is read most.**

⚠ **Three owner rulings arrived AFTER the prompts below were written, so the prompt text for G3
and G5 is stale where it names figures.** The current answers: the ₱500 supplier pack grants
**100 credits, not 25**; the video threshold **stays at 800** (the threshold was never wrong —
the credit under it got 4× dearer); and the **50-point Lite on-the-day gift stays**. See the
2026-09-06 rows in `DECISION_LOG.md` and `0012_papic/Vendor_Portfolio_Credits_2026-09-05.md`.

Planned 2026-09-05 from an owner working session. One session per file, one branch per session,
one PR, auto-merge armed, worktree pruned on merge — the `MB0–MB15` pattern.

Measured against `origin/main` @ `dd2288ebc` on 2026-09-05. Re-fetch and re-measure before acting
on anything below; a plan is not evidence.

**Every session below leads with its tier.** The owner runs these himself — a prompt without a
model and effort is an incomplete deliverable.

| Session | Model | Effort | Wave | Blocks |
|---|---|---|---|---|
| G1 — Land what is already built — ✅ **DONE 2026-09-05**: PR #5192 (A) · PR #5193 (B), auto-merge armed | Sonnet 5 | medium | ~~now~~ landed | G2 · G4 · G6 |
| ~~G2~~ — Vendor-portfolio Papic: ledger + price — ✅ **MERGED 2026-09-05** as PR #5201 (`0ebcf74b4`) | Fable 5.1 | high | done | G3 |
| ~~G3~~ — Vendor-portfolio Papic: the surface — ✅ **MERGED 2026-09-06** as PR #5267 | Sonnet 5 | high | done | — |
| ~~G4~~ — Cohort deals: verified vendors in a window — ✅ **MERGED 2026-09-05** as PR #5211; its creator UI shipped separately in PR #5225 | Fable 5.1 | high | done | — |
| ~~G5~~ — Event date-window credits + covered services — ✅ **MERGED 2026-09-06** as PR #5245 | Sonnet 5 | medium | done | — |
| ~~G6~~ — /admin/gifts polish — ✅ **MERGED 2026-09-06** as PR #5246 | Sonnet 5 | low | done | — |

---

## What already ships — do NOT rebuild any of it

RULE 0 applies to this plan itself. Every session is a DELTA on code that exists. The session
that found this out the hard way is recorded under "Corrections" at the bottom.

- **User/event comps** — `comp_grants` (user-scoped; `event_id` arrives in G1's migration),
  written by `issueCompGrant` / `revokeCompGrant` in `apps/web/app/admin/users/actions.ts`,
  read into gates by `event_has_comp_for_sku()` + `event_comp_active_skus()`
  (migration slug `comp_grant_entitlement_functions`), called from
  `apps/web/lib/entitlements.ts::eventHasCompGrant`.
- **Vendor comps** — tier only: `setVendorTier` in `apps/web/app/admin/vendors/actions.ts`
  writes `vendor_profiles.tier_state` + `tier_expires_at`. No ledger; history lives only in
  `admin_audit_log` (`action = 'vendor_tier_set'`). Per-vendor form at
  `/admin/vendors/[vendorProfileId]/plan`.
- **Date-window promos** — `promo_free_windows` (migration slug `promo_free_windows`), readers in
  `apps/web/lib/promo-free-windows.ts`, admin UI at
  `apps/web/app/admin/pricing/_surfaces/free-windows-surface.tsx`. Flag-gated OFF by
  `PROMO_FREE_WINDOWS_ENABLED`. ⚠ The vendor half is MORE built than the 2026-07-22 DECISION_LOG
  row implies: `applyVendorTierPromotion` has a live caller in
  `apps/web/lib/vendor-feature-gate.ts` (`grep -n applyVendorTierPromotion apps/web/lib`). Dark,
  not absent.
- **Vendor Papic allowance, 2026-08-26 version** — `₱5 paid = 1 shot`, floor 50, ceiling
  2,000; `VENDOR_PAPIC_PHP_PER_POINT` in `apps/web/lib/vendor-papic-tier.ts`, wired through
  `fetchVendorBookingFeePaidPhp` in `lib/vendor-papic-grants.ts`. ⚠ **Owner 2026-09-05:
  G2 REPLACES this rate** (*"replace it"*). It is listed here so G2 finds and retires it,
  not so anyone builds beside it. What is NOT yet decided is whether the host-visible upload
  lane it fed survives on the new rate — OPEN #1 below.
- **Couple free Papic pool** — `papic_seed_free_grant_trg`, now on `event_members` (G1's other
  migration). Account-scoped, first event only.

## G1 — LANDED 2026-09-05. This section is now the record of what shipped, not a to-do.

**Both MERGED 2026-09-05** — #5192 at `93239ece1`, #5193 at `c9f4d2830`. Duplicate edits
reverted from the main checkout by explicit path the same day; nothing of G1 remains in any
working tree. G2 (gated on OPEN #1) and G4 are now unblocked.

Both changesets went out as separate PRs from fresh worktrees off `origin/main` @ `dd2288ebc`:
**A = PR [#5192](https://github.com/iscasasola/setnayan-platform/pull/5192)**
(`claude/papic-free-credits-first-event-only`), **B = PR
[#5193](https://github.com/iscasasola/setnayan-platform/pull/5193)**
(`claude/admin-gifts-single-target-comps`). Auto-merge armed on both; worktrees pruned once
armed. **Two CI rounds followed** (see Corrections): A grew `a3327c9f8` + `93239ece1` (six
couple-less fixtures in all), B grew `813eb2614` (four registries) + `c9f4d2830` (exposure
baseline accepts `comp_grants.event_id` — one line, same shape as every sibling column;
reasoning in the PR body). Both branches carry a merge of `origin/main` from the
reproduction worktrees, which is what CI builds anyway. Every check in the G1 list ran green in the worktrees (unit, db incl. Ugat, timestamp
guard, all 29 `lint-*.mjs` CI guards, full `tsc` at a 6 GB heap under `.tsc.lock`). Two
DECISION_LOG rows written the same day. ⚠ The main checkout
(`claude/front-door-drops-hero-for-anchor`, PR #5174, **not ours**) still carries the same
edits uncommitted until the PRs MERGE — revert them there only after merge, by explicit path,
and leave the other session's files alone (`lib/modal-a11y-adoption.test.ts`,
`changelog.d/setnayan-ai-secretary-benefits.md`, `build-sessions/*.md`).

**Changeset A — free Papic credits are per-ACCOUNT, first event only** (owner-locked 2026-09-04)

```
supabase/migrations/20271204225094_papic_free_grant_first_event_only.sql
apps/web/lib/papic-free-grant.ts                      apps/web/lib/papic-free-grant.test.ts
apps/web/app/dashboard/(account)/create-event/actions.ts
apps/web/app/onboarding/simple/actions.ts             apps/web/app/onboarding/wedding/actions.ts
apps/web/app/onboarding/_shared/commit-event.ts
apps/web/tests/db/papic-free-grant-first-event-only.db.test.ts        (new, 6 cases)
apps/web/tests/db/papic-guest-spend-ceiling.db.test.ts                (fixture: adds a couple row)
apps/web/tests/db/seat-capture-is-atomic.db.test.ts                   (fixture: adds a couple row)
apps/web/tests/db/papic-dedicated-is-a-floor.db.test.ts               (fixture: adds a couple row)
changelog.d/papic-free-grant-first-event-only.md
```

**Changeset B — /admin/gifts + event-scoped comp grants + required reason on setVendorTier**

```
supabase/migrations/20271205612762_comp_grants_event_scoped.sql
apps/web/app/admin/gifts/page.tsx                     (new)
apps/web/lib/vendor-tier-comps.ts                     (new)
apps/web/lib/comp-grants.ts
apps/web/app/admin/users/actions.ts                   (issueCompGrant: optional event_id, host-checked)
apps/web/app/admin/vendors/actions.ts                 (setVendorTier: reason required, audited)
apps/web/app/admin/vendors/[vendorProfileId]/plan/page.tsx
apps/web/app/admin/_components/admin-nav-groups.tsx   (Gifts under People & shops, `Ticket` icon)
changelog.d/admin-gifts-single-target-comps.md
```

Verified so far: `tsc` clean (before the nav edit — G1 re-runs it), 14 unit tests in
`papic-free-grant.test.ts`, 18 Papic-adjacent db-test files green, both Ugat tests green
(6/6) with both migrations in the tree, `check-migration-timestamps.mjs` green.
**Not yet written:** a db test proving `event_has_comp_for_sku()` honours `event_id` (G1).

## Owner decisions made — do not re-ask

| Decision | Settled as |
|---|---|
| Free 50 Papic credits | First event ever, **account-wide**, not per event_type (*"first event it is"*) |
| Repeat event gets 1 credit, not 0 | Dictated by the fence: `papic_event_pool_status()` tests `SUM(points) > 0`; a 0-point row is invisible and reverts the event to unmetered. Explained 2026-09-04, not objected. Flag it once more in G1's PR body. |
| "All vendors" | **All verified vendors** — `vendor_profiles.verification_state = 'verified'`, never `tier_state` |
| Vendor grant scope for v1 | **Tier-only**, reusing `setVendorTier`; SKU-level vendor comps deferred to G6 |
| /admin/gifts v1 | **List + grant, single target** (a named vendor; a user account-wide OR one specific event) |
| Vendor-portfolio Papic — the rule | *"vendors get 5% of the amount they paid for on booking fee… ₱1,000 → 50 credits. If they import a user and sync for free, they pay ₱500 for 25 papic credits."* |
| Cap on the 5% grant | **1,000** — owner 2026-09-05, verbatim *"minimum of 1000"*, answering "cap: 1,000 or 2,000?". Read as the ceiling. ⚠ If he meant a FLOOR of 1,000 free credits it contradicts his own 5% rule (₱1,000 → 50) and makes the ₱500/25 pack pointless — G2 confirms the word before it codes a number. |
| When imported-event credits land | *"when we approve the payment"* — on admin payment approval (apply-then-pay), never at order submission and never self-reported. Imports carry NO booking fee by design (`BookingFeeAttribution = 'import'` → `waived_import` in `lib/booking-fee-gate.ts`), so for an import the only payment to approve IS the ₱500/25 purchase. |
| Coexist or replace the 2026-08-26 ₱5/point allowance | **Replace** — *"replace it."* Overrules the Fable + session recommendation to keep two pools. This REVERSES the 2026-08-26 lock and must be recorded as a reversal in `DECISION_LOG.md`, not slipped in. |
| Services the deals must cover | Papic · Live Stream (`LIVE_STUDIO`) · Event Hub Pro · Papic Challenges · 3D Booth · AI Chatbot |

## Owner decisions still OPEN — these gate G2 and G4

(#1–#3 of the original list were answered 2026-09-05 — see the table above. One new question
fell out of "replace it".)

| # | Question | Recommendation on file | Gates |
|---|---|---|---|
| ~~1~~ | ~~"Replace it" — does the host-visible upload lane survive?~~ **ANSWERED in the G2 session (2026-09-05):** *"base it all from the supplier's shots per event not from what the host gives them."* Read by G2 as: one meter per (vendor, event), the supplier's own; the couple's pool is a separate ledger; host approval and per-photo guest consent untouched. And *"minimum of 1000"* confirmed: *"yes. that is the maximum from booking fee."* | Built as PR #5201 (`claude/vendor-portfolio-papic-ledger`). G2's PR body raises THREE new owner questions — video at 800 (priced against the retired rate: 800 pts was a ₱4,000 fee, at 5% it is ₱16,000), whether the 50-pt Lite on-the-day gift also goes, and whether its reading of the lane answer is right. | G3 |
| 2 | Flip `PROMO_FREE_WINDOWS_ENABLED` in Vercel | Owner action, not code. G4 ships dark behind it. | G4 |
| 3 | Does the `price_php > 0` CHECK on `vendor_billing_catalog` (migration slug `v2_pricing_table_alignment`) block anything G4 needs? | Probably **not** — tier promotion moves `tier_state`, never a price. Only a true zero-price add-on row would hit it. G4 measures before assuming. | G4 |

---

## G1 — Land what is already built

**Model:** Sonnet 5 · **Effort:** medium · **Wave:** now · **Blocks:** G2 · G4 · G6

Two worktrees off `origin/main`, two branches, two PRs — A and B are independent and must not
share a PR. Order: A first (smaller, fully tested), then B.

1. `git worktree add --detach /tmp/wt-gifts-a origin/main` (and `-b` a branch), copy Changeset A
   in by path, `pnpm install` there — a fresh worktree has no `node_modules`, and tests there
   "pass" resolving nothing.
2. Run from `apps/web`: `npx tsx --test lib/papic-free-grant.test.ts`; the five db-test files
   named above plus `tests/db/ugat-schema-claims.db.test.ts` and
   `tests/db/ugat-concept-coverage.db.test.ts`; `node scripts/check-migration-timestamps.mjs`
   from the root; `npx tsc --noEmit -p tsconfig.json` (budget ten minutes; it OOMs under load —
   write output to the scratchpad, never `/tmp`, and read `TSC_EXIT=`, not the wrapper's code).
3. The blocking guards are separate CI steps, NOT `pnpm lint` — run every `run:` line under
   `.github/workflows/ci.yml` that starts with `node … lint-*.mjs`, from the directory the
   workflow uses (`grep -n "run: " .github/workflows/ci.yml`). `zsh` does not word-split a
   command held in a variable; write the loop with an array or `eval`.
4. PR A, `gh pr merge --auto --merge`. Prune the worktree the moment it is armed.
5. Repeat for Changeset B, plus ONE new file: `apps/web/tests/db/comp-grants-event-scoped.db.test.ts`
   — a user hosting two events, a grant with `event_id` set to one of them; assert
   `event_has_comp_for_sku()` is TRUE on that event and FALSE on the other; assert a NULL
   `event_id` grant is TRUE on both; assert `event_comp_active_skus()` agrees. Then the guards,
   then PR B.
6. Corpus (standing authorization 2026-06-04): one `DECISION_LOG.md` row per changeset, following
   `COWORK.md`. Both fragments say `SPEC IMPACT:` is pending — this closes them.

**Done when:** both PRs MERGED, both worktrees gone, `git worktree list` shows nothing of ours,
DECISION_LOG carries both rows.

## G2 — Vendor-portfolio Papic: the ledger and the price

**Model:** Fable 5.1 · **Effort:** high · **Wave:** after G1 and OPEN #1 · **Blocks:** G3

The vendor's own dedicated shots for their own portfolio — never the host's, never a guest's.
**This REPLACES the 2026-08-26 allowance** (owner 2026-09-05), so G2 retires
`vendorPapicPointsForBookingFee` / `VENDOR_PAPIC_PHP_PER_POINT` / the 50-floor / 2,000-ceiling
rather than building beside them. Record it in `DECISION_LOG.md` as a **reversal** of the
2026-08-26 row, quoting *"replace it"* — the same way that row recorded its own reversal of
2026-07-18.

- `credits = floor(booking_fee_php × 0.05)`, granted even when tiny (Fable: *"grant the crumbs,
  sell the loaf next to them"*), **capped at 1,000** (owner: *"minimum of 1000"* — confirm it is
  the ceiling he means before coding it; see the MADE table).
- Credits land **on admin payment approval**, never at submission (*"when we approve the
  payment"*). For a booked event that is the booking-fee approval; for an import there is no
  booking fee (`waived_import`), so the trigger is approval of the ₱500/25 purchase itself.
- Flat purchase: `vendor_billing_catalog` row, ₱500 → 25 credits (₱20/credit — the same implied
  rate as the formula; the owner's two numbers already agree). Admin-editable; the number lives
  in the table, never in code.
- The booking fee is read from `booking_fee_charges` via `fetchVendorBookingFeePaidPhp` in
  `apps/web/lib/vendor-papic-grants.ts` — keep the SAME "null is a failed read, never ₱0" rule;
  `waived_free5` means they paid nothing.
- Ledger: `vendor_papic_capture_grants` (migration slug `vendor_papic_capture_counsel_gated`) is
  the existing table; since the old rate is retired, a new `source` value there is the whole
  schema delta. A second table is the last resort.
- What "replace" does to the video-at-800 threshold and the `canCapture` `video_not_allowed`
  branch is NOT specified — do not silently keep or drop them; surface it with OPEN #1.
- Pure function + unit tests; a db test for the ledger; Ugat map claims updated for anything
  the retirement removes (`ugat-schema-claims.db.test.ts` will say if the map still asserts the
  old constants).

## G3 — Vendor-portfolio Papic: the surface

**Model:** Sonnet 5 · **Effort:** high · **Wave:** after G2

Vendor dashboard: buy 25-credit packs (apply-then-pay, the existing order flow), a private
portfolio album visibly separate from `vendor-own-captures.ts` (which shows their shots on
OTHER people's events), and the under-25-credits upsell CTA beside the grant readout. Storage
prefix and visibility must be provably not the host gallery — a db test that the host's readers
return none of it.

## G4 — Cohort deals: verified vendors in a window

**Model:** Fable 5.1 · **Effort:** high · **Wave:** after G1 · **Blocks:** G5

Two audience shapes on `promo_free_windows`:

- `all_vendors` — already resolves through `vendor-feature-gate.ts`. Add the
  `verification_state = 'verified'` filter (owner: all vendors means all VERIFIED vendors).
- `new_verified_vendors` — NEW value: a vendor qualifies when their sign-up AND doc-approval both
  fall inside `[starts_at, ends_at]`, evaluated statelessly at gate time. No per-vendor row, no
  job — the same pattern the date windows already use. ⚠ The `audience_type` CHECK re-lists its
  vocabulary (`grep -n "audience_type" supabase/migrations/*promo_free_windows*`); a re-listed
  CHECK that forgets a value fails only at ALTER validation against real rows — the PGlite
  replay is what catches it. Also the `(audience_type = 'all_vendors') = (promoted_vendor_tier
  IS NOT NULL)` constraint must be extended, not bypassed.
- `/admin/gifts` grows a "Deals" section: the creator (who · window · what's free · deal length
  per vendor — a SEPARATE control from the window, and the copy must say so) and rows in the
  unified list typed `window`. The read side is a view or a second reader — never a third table.
- Ships dark behind `PROMO_FREE_WINDOWS_ENABLED` (OPEN #4). Measure OPEN #5 before assuming.

## G5 — Event date-window credits + covered services

**Model:** Sonnet 5 · **Effort:** medium · **Wave:** after G4

- Extend `covered_service_keys` handling in `lib/entitlements.ts` to `LIVE_STUDIO` and Event
  Hub Pro. The Event Hub Pro service code is NOT confirmed by this plan — find it
  (`grep -rn "hub" apps/web/lib/entitlements.ts apps/web/lib/v2-catalog.ts`), do not guess.
- "Any event dated in a range": check `getLiveCoupleFreeWindows` for an `event_date` predicate
  before adding one (RULE 0).
- The `/admin/gifts` list shows couple windows as `window` rows next to vendor ones.

## G6 — /admin/gifts polish

**Model:** Sonnet 5 · **Effort:** low · **Wave:** whenever

- `return_to` on `setVendorTier` and `issueCompGrant` so a grant made from `/admin/gifts` lands
  back on `/admin/gifts` (today: the vendor's `/plan`, `/admin/users`). Keep the existing
  redirects as the default — other pages read their banners.
- SKU-level vendor comps via the dormant `comp_grants.vendor_profile_id` column. ⚠ Read
  `comp_grants_enforce_self_comp_quota` (BEFORE INSERT, migration slug `self_review_gate`)
  first — a `vendor_profile_id` row may be counted against a vendor's self-comp quota.
- The `fetchCompedVendors` trip-wire: when self-serve vendor billing ships, a `source` column on
  the tier change is needed or every paying vendor will read as a gift.

---

## Corrections made during planning — so nobody re-learns them

- **"Live Studio Challenges for vendors"** is not a SKU. It was invented in the first mockup. The
  vendor product is **Papic Challenges** (₱2,500/28d).
- **`comp_grants` did NOT support "a specific event"** until migration `20271205612762`. It was
  user-scoped only; an earlier research pass said otherwise.
- **The couple free grant's real writer was a DB trigger**, not `ensureFreePapicPoolGrantAdmin`.
  That module's docblock ("nothing ever wrote the free grant") was stale; the trigger had been
  winning the race since migration slug `papic_free_event_pool_seed`.
- **A 0-point grant fences nothing.** `papic_event_pool_status()` sums points; the first draft
  relaxed the CHECK to allow 0 and would have shipped unmetered events.
- **`all_vendors` is not "unbuilt".** The resolver has a caller (`vendor-feature-gate.ts`); the
  gap is the admin affordance and the flag.
- **The Gifts nav entry was reported done before it was edited** (2026-09-05). Fixed the same
  day; G1 re-runs `tsc` because of it.
- **"5%" vs "1%" vs "₱5/point"**: the live 2026-08-26 rule is ₱5/point (not a percentage). The
  5% figure is the owner's rule for the portfolio product — which, as of 2026-09-05, **replaces**
  the ₱5/point rule rather than sitting beside it.
- **"Coexist" was recommended twice (this session + Fable) and overruled** — *"replace it."*
  A recommendation is not a decision; the plan carried the wrong default for a day.
- **G1's first CI run failed both PRs on Unit tests (4 + 4) with every local check green.**
  A: two `lib/**` suites replay the schema and assumed every bare `events` row is born with
  50 — the dependents sweep was scoped to `tests/db/`. B: a new admin page must join four
  registries (`ConsoleTable` + its `CONVERTED` list · regenerated `admin-routes`/`admin-jobs`
  files · `ADMIN_NAV_DESCRIPTIONS`/`ALIASES` · `MODEL_CHOICE_CAP`, which is exactly tight and
  rises by one per page — 140 → 141). Fixed the same day (`a3327c9f8`, `813eb2614`); full
  `pnpm test:unit` now part of the checklist. Memory:
  `a-new-admin-page-must-join-four-registries`. **G2–G6: run `pnpm test:unit` before every PR.**
- **The second CI run reached the DB replay and found a sixth couple-less fixture**
  (`papic-guest-own-credits-are-hers`) — and something under it: two `>=` assertions there
  pass only by the free 50's slack; with it gone the pot reads `used 21` where the test says
  "exactly 20" (a refused capture's `papic_reserve_capture_split` is never released). Parked
  the migration on the same base: still 21. Fixture repaired to production shape, the number
  written at the fixture, the discrepancy flagged in PR #5192 rather than fixed there. Memory:
  `a-fixtures-padding-can-hide-an-off-by-one`. **G2–G6: run `pnpm test:db` (all ~235 files)
  before any PR carrying a migration — 18 files was not the suite.**
