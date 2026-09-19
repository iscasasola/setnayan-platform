## 2026-09-19 · fix(supplier): result-dropped-silently, SUPPLIER tier batch 2/4

S41c batch B — 17 sites (18 findings; `live-studio-channel-grants.ts` carried 2
call sites for the same table) from the S26 both-ends baseline (#5625,
`tier=SUPPLIER-FACING, class=result-dropped-silently`). Same disease S41 already
fixed for MONEY (#5650) and BOOKING (#5656): a Supabase read whose `error` is
tested only as an if/else boolean, where the branch it picks records nothing —
so a REFUSED read renders identically to a genuinely empty one.

**Shape 2 (honest render state — 2 sites).** Two supplier-facing performance
cards collapsed a refused RPC to the same copy as a genuinely-suppressed
(below min-N) result:

| site | before | after |
|---|---|---|
| `lib/demand-radar.ts` `rpc:demand_radar_for_vendor` → `DemandRadarCard` | "Not enough demand data yet" over a refused read | distinct sentinel `DEMAND_RADAR_UNREADABLE`; card says "We couldn't load your demand radar right now" |
| `lib/funnel-benchmark.ts` `rpc:funnel_benchmark_for_vendor` → `FunnelBenchmarkCard` | "Not enough shops like yours yet" over a refused read | distinct sentinel `FUNNEL_BENCHMARK_UNREADABLE`; card says "We couldn't load your peer comparison right now" |

**Shape 1 (log-only — remaining 16 call sites).** Internal / control-plane /
best-effort call sites (live-studio camera + channel-pool provisioning, encoder
claims, overlay + highlight reads, the email-delivery cron-free checker, an
admin-analytics aggregate, an actions.ts re-read, an onboarding taxonomy read
with an existing static fallback) — each now logs
`console.error('[supabase-error] <path> · <target>', error, …)` at the point
the reason used to be discarded:

- `app/vendor-dashboard/shop/inline-docs-actions.ts` — `vendor_verification_applications.select` (×2: `updateDocUploadInline` re-read + `readContactStamps`)
- `lib/creator-analytics.ts` — `creator_chapters.select`
- `lib/email-delivery.server.ts` — `email_deliveries.update`
- `lib/live-shops.ts` — `vendor_profiles.select` (already returned `null`, distinct from `0`; just needed the reason on record)
- `lib/live-studio-channel-cameras.ts` — `panood_camera_operators.update`
- `lib/live-studio-channel-grants.ts` — `live_studio_channel_grants.select` ×2
- `lib/live-studio-encoder-claims.ts` — `live_studio_encoder_claims.insert`
- `lib/live-studio-overlays.ts` — `live_studio_overlay_settings.select` + `live_studio_highlights.select`
- `lib/live-studio-recordings.ts` — `live_studio_roam_streams.update`
- `lib/live-studio-roam-provision.ts` — `live_studio_roam_channel_pool.select` + `.update`
- `lib/live-studio-window-server.ts` — `panood_control_state.select`
- `lib/nsfw-screen.ts` — `editorial_vendor_media.select`
- `lib/onboarding-refinements.ts` — `service_categories.select`

**Proof:** the #5625 scanner (`scanSourceDetailed(src, file, { silentDrops: true })`)
run against all 15 target files went from 18 findings across the requested
targets → 0. New `lib/s41c-supplier-batch-b-reads-are-honest.test.ts` — 11/11
green; sabotage-checked by hand (reverted the demand-radar shape-2 fix → red on
the sentinel + log assertions; reverted the onboarding-refinements log line →
red on the source-assertion test; restored both, confirmed green again).

SPEC IMPACT: None.
