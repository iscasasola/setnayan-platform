## 2026-11-24 · data(trust): trusted shops start ranking, gently (trust_search_step = 3)

- New data migration `20271362487248_trust_search_step_is_three_gentle.sql` sets `platform_settings.trust_search_step` to **3**, the owner's number ("3 — gentle", DECISION_LOG 24 Nov). A shop moves up one search step at 1, 3, 9, 27 … real, mutual, qualified trusted partners.
- Guarded: it writes only while the value is NULL, so an admin's later setting is never overwritten. It stays editable in Admin › Settings.
- Until this lands, the column added by the Trust migration (#8253, live in the 24 Nov train) is NULL, and trust lifts nobody in search.

SPEC IMPACT: None. The ruling is already recorded in DECISION_LOG (24 Nov, "3 — gentle").
