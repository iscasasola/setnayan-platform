## 2026-07-09 · fix(pricing): surface the Live Studio — Mobile Controller row

The device-tier repackaging (PR #2928) added `PANOOD_SYSTEM_MOBILE` to the catalog + `BUILD_STATUS`, but the `/pricing` add-on section renders from a hardcoded `ADDON_GROUPS` list keyed by `service_code` — so the Mobile row was silently dropped from display (only Desktop showed). Add `PANOOD_SYSTEM_MOBILE` to the "Go live & interactive" group (listed before Desktop) so both Live Studio tiers render.

SPEC IMPACT: None — completes the display half of the already-recorded Live Studio repackaging.
