## 2026-06-29 · feat(vendor): Shortlist Radar (Wave 2 vendor benefit)

Ships the vendor-facing **Shortlist Radar** end-to-end: a live "N couples saved
you" tally plus a de-identified "rival in your area" demand feed on the vendor
dashboard home.

- **Migration** `20270319863926_shortlist_radar_rpcs.sql` adds two SECURITY
  DEFINER, STABLE RPCs (idempotent · `CREATE OR REPLACE`):
  - `public.count_saves_for_vendor(p_vendor_profile_id UUID) RETURNS INTEGER` —
    distinct-saver count across `vendor_follows` + `guest_saved_vendors`.
    Owner/admin gate (`current_vendor_profile_ids()` / `is_admin()`); returns
    only the integer, never user_ids.
  - `public.rival_signals_for_vendor(p_vendor_profile_id UUID) RETURNS
    TABLE(month_bucket DATE, region_code TEXT, signal_count INTEGER)` — de-id
    (month, region, count) demand rollup over `event_vendors` + `chat_threads`
    in the caller's `vendor_profiles.hq_region`. Honors the admin
    `radar_enabled` toggle and suppresses below-floor cells via
    `public.min_n_ok()` against admin-managed `radar_min_n_floor`. No couple
    identity in output. Region-scoped (not category-scoped) — `services TEXT[]`
    has no sound join onto the `event_vendors` category enum (noted in-code).
  - Both `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO authenticated`.
- **Server action** `getShortlistRadar()` in `app/vendor-dashboard/actions.ts`
  resolves the caller's own vendor_profile_id (`fetchOwnVendorProfile`) and
  calls both RPCs via the RLS-scoped client; best-effort, returns zeros/empty
  on any error.
- **UI** new server component `_components/shortlist-radar-card.tsx` mounted on
  `app/vendor-dashboard/page.tsx` (separate file from `vendor-stats-panel.tsx`
  to avoid a merge collision with the parallel First-Look PR).
- **Admin surface**: the `radar_enabled` toggle + `radar_min_n_floor` already
  live on `platform_settings` (admin-managed) — no new admin UI added.
- Substrate (`radar_min_n_floor` / `radar_enabled` / `min_n_ok`) reused, not
  recreated. `guest_saved_vendors` RLS NOT modified (stays owner-only).

SPEC IMPACT: None. (Wave 2 vendor-benefit implementation; thresholds remain
admin-managed config, no SKU/pricing/schema-of-record change.)
