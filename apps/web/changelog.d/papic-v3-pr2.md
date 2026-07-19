## 2026-07-17 · feat(papic): Mini per-event cap column + caps admin-only guard (PR-2 of 12)

Two safe, additive pieces of the Papic v3 caps model. No billing behavior change (the roll→Mini remap + `papic_ltd_cap_php` backfill land atomically with their quote code in a later PR).

- `events.papic_mini_cap_php` (default ₱6,000) — the Mini / legacy-roll tier's per-event WEDDING cap. Additive; unread until the quote code lands.
- `events_papic_caps_admin_only` BEFORE-UPDATE guard — blocks an **authenticated non-admin** from changing any `papic_*_cap_php` (couples have unrestricted row UPDATE today → could self-discount their own price cap). Safe by construction: service-role (`auth.uid() IS NULL`) + admins pass; caps unchanged never trip it (`IS DISTINCT FROM`).

**SPEC IMPACT:** None — corpus already carries the v3 caps model (`0012_papic/Papic_Good_Better_Best_Pricing_2026-07-17.md` · `Papic_Build_Brief_2026-07-17.md`). Security hardening of an existing exposure.
