## 2026-06-29 · feat(discovery): Wave 2 substrate — admin-managed discovery config + min-N helper

Foundational infra for Wave 2 (First-Look Window + Shortlist Radar). One
idempotent migration (`20270319817376_vendor_discovery_config_and_min_n.sql`),
no app code yet — the consumer PRs add their born-used getters.

- **Admin-managed tunables** on `platform_settings` (the canonical single-row
  global config, already admin-RLS — no hardcoded thresholds, per the lock):
  `firstlook_sla_hours` (default 24), `firstlook_boost_weight` (default 0.10,
  capped ≤ 0.5 so score normalization holds), `radar_min_n_floor` (default 1),
  `radar_enabled` (default true). CHECK constraints guard the ranges.
- **Reusable min-N suppression helper** `public.min_n_ok(count, floor)` —
  `IMMUTABLE`, floor clamped to ≥ 1 so a misconfig can't disable suppression;
  the one place every de-identified aggregate (Shortlist Radar's rival signals,
  the whole Wave-6 analytics group) enforces the behavioral-data min-N lock,
  instead of re-deriving it each time. `EXECUTE` granted to `authenticated`.

Additive + idempotent; new columns inherit platform_settings' admin-only write
RLS (no policy change). CI applies the migration + runs the build.

SPEC IMPACT: None — foundational config + a SQL helper; no SKU/pricing/flow
change. Thresholds are admin-managed config rows (honors the no-hardcoded lock).
