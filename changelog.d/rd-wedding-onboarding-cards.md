## 2026-10-01 · feat(onboarding): the approved wedding onboarding — Lane 1, on the one setup engine

Once the seed admits weddings to the setup engine, `/onboarding/wedding` walks
the owner-approved cards (DECISION_LOG 2026-10-01 "APPROVED — WEDDING
ONBOARDING (clickable)…", spec `WEDDING_ONBOARDING_HUB_SETUP_EVENT_DETAILS_BUILD_SPEC_2026-10-01`):
names · kind of wedding · the shipped hot-date calendar · area · "How do guests
get in?" (one dropdown: Guest list · Guest list + requests · Open event) · guest
estimate (− / + , 10–500 by 10) · budget (`budget_band_config` per-head median ×
the estimate, Classic pre-selected) · cover photo · theme (Free / Pro ◆) ·
colours · the services step. Every answer writes the wizard field the shipped
commit already turns into the Maker's own column (`bride_name` · `ceremony_type` ·
`date_candidates` · `region` · `estimated_pax` · `budget_band` · `invite_theme` ·
`rsvp_ask_config` · `mood_feel_key`); no new column, no setup-only table.

Extends #6233 — `SetupFrame` is the engine's card frame now (one look for the
engine's cards and the wedding's own); `lib/onboarding/wedding-cards.ts` is the
one place that holds the order and the answer mappings. A wedding the seed has
not admitted is byte-identical to yesterday.

Also: the Papic card on the services step opens on "We recommend {pack} Papic
credits for your {guests} guests." — the NEAREST live `PAPIC_GUEST_*` pack, a
tie goes up — with a − / + stepper and an explicit "Add Papic · ₱X" / "Not now".
Sized from `papic_event_pool_config` (admin-editable) and never from a number
in code; unreadable config recommends nothing. **This supersedes the 2026-09-23
"nothing to recommend until measured" ruling for this one surface, by the
owner's 2026-10-01 word; `the-recommendation-waits-for-data.test.ts` now names
`lib/onboarding/papic-recommendation.ts` as the single sanctioned module.**

Guards: `lib/onboarding/wedding-cards.test.ts` (order, kind mapping, estimate,
budget rows, the prefill guard), `lib/onboarding/papic-recommendation.test.ts`,
and the amended `lib/the-recommendation-waits-for-data.test.ts` — each
sabotage-checked.

SPEC IMPACT: None (the DECISION_LOG rows already record this; the Papic
recommendation's reversal of 2026-09-23 is flagged for owner sign-off).
