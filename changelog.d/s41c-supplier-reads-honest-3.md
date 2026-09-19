## 2026-09-19 · fix(supplier): result-dropped-silently, SUPPLIER tier batch 3/4

From S26's orphan baseline (`result-dropped-silently`, PR #5625/#5680), SUPPLIER
tier, batch 3 of 4 (S41c). Every site here is shape 1 (log-only): each is an
internal helper, a background job, or a read that already degrades to a
documented, deliberate fallback where a supplier never saw a refused read render
identically to a genuine absence. The fallback value on error is UNCHANGED in
every case — only the reason is no longer discarded silently.

One `console.error('[supabase-error] …')` line added at the point `error` used
to be tested only as a boolean:

- `lib/requirements-capture.ts` · `from:canonical_service_schemas.select` (`isPersistableCanonicalService`)
- `lib/same-day-vendors.ts` · `from:vendor_profiles.select` (`findSameDayVendors`)
- `lib/service-merge-forward-db.ts` · `from:canonical_service_taxonomy.select` (`getServiceMergeForwards`)
- `lib/service-trade-aliases-db.ts` · `from:canonical_service_aliases.select` (`getReviewedTradeAliasRows`)
- `lib/stage-notes-recipients.ts` · `from:vendor_services.select` (`fetchEmceeRecipients`'s per-service category read)
- `lib/supplier-night-before-email.ts` · `from:supplier_night_before_email_log.insert` — logs only when the insert failure is NOT the expected `23505` unique-violation (already claimed for this booking+date); the common case stays silent on purpose
- `lib/trusted-circle-recs.ts` · `rpc:trusted_circle_vendor_signal` (`getTrustedCircleVendorSignal`)
- `lib/vendor-branches.ts` · `from:vendor_branches.select` (`fetchPublicVendorBranches`)
- `lib/vendor-card-copy.ts` · `from:vendor_services.select` (`buildCanvasInitialFromCard`)
- `lib/vendor-corrections.ts` · `from:vendor_profiles.select` (`fetchVerifiedLock`)
- `lib/vendor-counts.ts` · `from:vendor_profiles.select` — **2 call sites** (`loadVerifiedVendorMarketplaceCount` and `fetchVendorCountsByService`; the batch row named one, both silently discarded the same table's error so both are fixed)
- `lib/vendor-dayof-config.ts` · `from:vendor_dayof_configs.select` — **2 call sites** (`fetchDayOfOverride`, `fetchSongRequestsPaused`)
- `lib/vendor-deep-search-addon.ts` · `from:vendor_deep_search_uses.select` (`countDeepSearchUsesSince`)
- `lib/vendor-earnings.ts` · `from:platform_settings.select` (`getSetnayanFeePct`)
- `lib/vendor-first-steps.server.ts` · `from:vendor_services.select` (`countVendorServices`)
- `lib/vendor-microsite.ts` · `from:vendor_profiles.select` — **2 call sites** (`fetchVendorMicrosite`'s main select and its separate `microsite_video_ids` read, which previously did not even capture `error`)

**Skipped, moot:** `lib/upcoming-items.ts` · `from:vendor_meetings.select` (row
42). Open PR #5655 (S39, `table-no-writer`) deletes `fetchVendorMeetings` and
this exact read outright — nothing writes `vendor_meetings`, the table is being
dropped, and #5655's own changelog notes it "pays down" this line. Fixing it
here would be dead code the moment #5655 lands; whichever PR merges second is
unaffected either way since #5655 removes the function, not just the log site.

**Known overlap, not a conflict:** open PR #5680
(`claude/area-vendor-earnings-read-the-ledger`) also touches
`lib/vendor-earnings.ts`, replacing `fetchVendorEarnings`'s reader entirely —
but it does not touch the `platform_settings.select` read fixed here (verified
via `gh pr diff 5680 -- apps/web/lib/vendor-earnings.ts`). Should not collide
line-for-line; a rebase/merge may still be needed once both land.

Test: `lib/s41c-supplier-batch-c-reads-are-honest.test.ts` — 26 cases. Per-site:
the fallback value on a refused read is pinned unchanged, and the refusal is
now actually logged (captured via a `console.error` spy against a stubbed
client); two genuine-success cases assert no spurious logging. A closing
source-scan counts each touched file's `[supabase-error]` log-site occurrences
exactly (not just "at least one" — a file-level presence check would miss a
second call site in the same file, which three of these files have).
Sabotage-proven locally: reverting either of two log lines (a single-site file
and a two-site file) turned the matching test(s) red before the fix was
restored.

SPEC IMPACT: None
