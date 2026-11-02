## 2026-07-12 · feat(profile): optional self-profile personalization — religion + civil status (date-anchor Phase 1)

The first personalization fields of the date-anchor model — the self-consented, un-gated slice. Owner-decided 2026-07-12: religion + civil status are **reference-only, never required, opt-in**, and both are **sensitive PI under RA 10173 §3(l)** (religious affiliation; marital status), so each carries durable proof-of-consent. (Birthdate already exists on the profile — not re-added.)

- **Migration `20270732591262`** — adds `users.religion` + `users.civil_status` (CHECK-constrained value sets) and their `*_consent_at` timestamps. RLS inherited (users Pattern-A). Idempotent.
- **`lib/profile-personalization.ts`** — pure value sets + labels + validators (`CIVIL_STATUSES` single…separated, no civil divorce; `RELIGIONS` aligned to the faith-registry keys for a future ceremony pre-select) + `consentPatch()` (stamp on first value, clear on withdrawal, untouched when unchanged). 7 unit tests.
- **Profile page** — a "Personalize your events — optional" fieldset with the two selects, purpose copy, and the **"We store your events, not your documents"** trust line. Both default to "Prefer not to say"; blank changes nothing.
- **`updatePersonalInfo`** — saves religion + civil_status and stamps each `*_consent_at` per field on the transition (mirrors the existing `marketing_consent_at` logic).

Reference-only: never used to verify, gate, share, or require. No other surface reads them yet — the ceremony pre-select + life-stage picker wiring are follow-ups.

SPEC IMPACT: implements Faith_Aware_Person_Graph §1 + the master plan's Phase-1 self-profile fields (self opt-in carve-out).
