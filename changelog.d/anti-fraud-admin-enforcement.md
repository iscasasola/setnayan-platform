# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(anti-fraud): Phase 4 — admin fraud queue + two-stage enforcement (auto-suspend + admin-confirmed wipe/ban)

Phase 4 of the Anti-Fraud & Trust Integrity workstream (spec `03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md` § 5). Adds the human-facing fraud queue + the owner-locked two-stage enforcement. Stacks on Phase 3 (`fraud_signals` + `vendor_fraud_scores`).

**Owner-locked model (§ 5):** the ONLY automated action is a REVERSIBLE **auto-suspend** at a high-confidence score (hide + freeze badges, no data loss). The **permanent wipe + ban** is IRREVERSIBLE, **admin-confirmed only, never automated**, and routed through the existing **two-admin (four-eyes) approval gate**. Appeal routes to the help-center ticket queue.

New migration `supabase/migrations/20270518682623_fraud_enforcement_state_and_audit.sql`:

- **`vendor_profiles` enforcement columns** — `fraud_suspended_at` (system auto-suspend), `fraud_banned_at` (admin-confirmed ban), `fraud_tombstoned`. A three-column state model chosen so the freeze composes with the existing `public_visibility` machine — an enforcement action also flips `public_visibility → 'hidden'`, so every public read path (marketplace query, `/v/[slug]` 404, `api/v1/vendors`, spotlight pool) freezes the vendor with zero cross-cutting query edits.
- **`voided_by_fraud` flags** on `vendor_reviews` + `event_vendors` (soft-delete for evidence retention). The two vetted matviews `vendor_trusted_review_stats` + `vendor_public_completed_events_stats` are recreated VERBATIM plus a single `AND … voided_by_fraud = FALSE` predicate, so a ban voids the ring's reviews/events from every public stat.
- **`fraud_enforcement_audit` TABLE** — one row per `auto_suspend | unsuspend | dismiss | ban_wipe`, `actor_user_id` NULL = SYSTEM, `evidence_snapshot` JSONB (non-PII, non-mutating). Admin/service-role RLS at CREATE; `generate_public_id('E')`.
- **`approve_fraud_wipe_ban`** added to `admin_approval_requests.action_type` CHECK — the wipe+ban rides the existing four-eyes gate (`target_id` = vendor_profile_id, per the `approve_vendor_partnership` precedent).

New libs:

- `apps/web/lib/fraud-enforcement.ts` (pure, tsx-testable) — `FRAUD_AUTOSUSPEND_THRESHOLD` (strictly above the P3 advisory `VENDOR_FRAUD_ATTENTION_THRESHOLD = 60`), `deriveVendorFraudState`, `isFrozenByFraud`, and the pure `shouldAutoSuspend(...)` decision (idempotent — never re-suspends/re-bans). _(Threshold + a ≥2-signal corroboration guard tightened below on 2026-07-05.)_
- `apps/web/lib/fraud-enforcement-runner.ts` (`server-only`) — `maybeAutoSuspendVendor` (the one allowed automated action: atomic guarded suspend + `auto_suspend` audit, fail-soft), `runAutoSuspendSweep`, `writeFraudEnforcementAudit`, `buildFraudEvidenceSnapshot`, and `fetchFraudFrozenVendorIds` (the defense-in-depth freeze set).

Wiring:

- **Auto-suspend** fires from the Phase-3 runner (`fraud-detection-runner.ts`) after the aggregate refresh — per-vendor on the single path, a sweep at the end of the full pass. Never bans.
- **Freeze** — `app/explore/page.tsx` excludes `fetchFraudFrozenVendorIds` from the marketplace query (always, even in demo mode); `lib/spotlight-awards.ts` drops frozen vendors from the badge candidate pool. Badge inputs never see frozen vendors because they're excluded from the query that feeds them.

New admin surface `app/admin/fraud/` — server component listing `vendor_fraud_scores` (sorted `max_open_score DESC`) with each vendor's open `fraud_signals` + readable non-PII evidence chips + derived state badge. Row actions (server actions, admin-gated, audited): **Dismiss** (false positive; also un-suspends), **Un-suspend** (reverse without clearing signals), and **Confirm fraud → wipe + ban** via a typed-confirmation ("type the business name") dialog that opens the two-admin request. The `executeFraudWipeBan` executor (invoked by the approvals confirm path) voids reviews/events, tombstones + bans + `demotion_count + 1`, refreshes matviews, audits with an evidence snapshot, and opens a help-center appeal ticket stub. Registered in the nav registry (`admin.sidebar.fraud`, ShieldAlert) + `ADMIN_NAV_GROUPS`.

Tests `apps/web/lib/fraud-enforcement.test.ts` — deterministic coverage of the auto-suspend threshold decision, the state derivation, and the "suspended/banned vendor excluded" freeze filter.

Migration is a FILE only; CI applies on merge. RLS at CREATE. Idempotent.

SPEC IMPACT: None — implements the already-locked § 5 enforcement model / § 6 Phase 4; no new product surface exposed to customers/vendors and no pricing change. (The enforcement + admin surface need owner + counsel sign-off before merge — flagged in the PR body.)

## 2026-07-05 · fix(anti-fraud): safer auto-suspend — raise threshold to 95 + require ≥2 distinct signals

Owner-decided "safe" config for the ONE automated action (§ 5 auto-suspend). Makes the reversible auto-suspend more conservative and, critically, requires **corroboration** so a single over-eager heuristic can never take down a legitimate vendor on its own.

- `apps/web/lib/fraud-enforcement.ts`:
  - `FRAUD_AUTOSUSPEND_THRESHOLD` raised **90 → 95**. The module-load invariant that it stays strictly above `VENDOR_FRAUD_ATTENTION_THRESHOLD` (60) still holds.
  - New constant `FRAUD_AUTOSUSPEND_MIN_SIGNALS = 2`.
  - `shouldAutoSuspend` signature changed to take the distinct open-signal-type count: `shouldAutoSuspend(aggregateScore, distinctSignalCount, currentState)`. Returns `true` only when `score ≥ 95` **AND** `distinctSignalCount ≥ 2` **AND** the vendor is currently `active`. Rationale in-comment: a lone maxed detector (e.g. `rating_shape` on a genuinely all-5★ vendor) must surface in the admin queue, never auto-suspend.
- `apps/web/lib/fraud-enforcement-runner.ts`:
  - `maybeAutoSuspendVendor` now reads `open_signal_count` (falling back to `open_signal_types.length`) from `vendor_fraud_scores` and passes it into `shouldAutoSuspend`. Still idempotent + fail-soft; never blocks the user write it piggybacks on.
  - `runAutoSuspendSweep` pre-filter adds `.gte('open_signal_count', FRAUD_AUTOSUSPEND_MIN_SIGNALS)` so lone-signal vendors aren't even candidates (the per-vendor `shouldAutoSuspend` re-check remains the authority).
- `apps/web/lib/fraud-enforcement.test.ts`: auto-suspend TRUE only for score ≥95 AND ≥2 distinct signals; FALSE for 96 w/ 1 signal; FALSE for 94 w/ 3 signals; TRUE for 95 w/ exactly 2 signals; plus a config assertion (95 / 2) and NaN/missing signal-count guards.

SPEC IMPACT: None — a conservative retune of the already-locked § 5 auto-suspend thresholds (config, not a new mechanism). No schema, pricing, or product-surface change.
