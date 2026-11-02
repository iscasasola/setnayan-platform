## 2026-07-24 · fix(retention): purge_expired_chat no longer aborts on inquiry_outcomes

Gap audit 2026-07-23 · Batch B2. `inquiry_outcomes.chat_thread_id` FK was
`ON DELETE SET NULL`, but `inquiry_outcomes_has_anchor` CHECK requires
`(vendor_proposal_id IS NOT NULL OR chat_thread_id IS NOT NULL)`.
`recordInquiryOutcome` always inserts with `chat_thread_id` set and
`vendor_proposal_id` NULL, so when `purge_expired_chat(5)` deletes an aged
`chat_threads` row the SET NULL nulled the outcome's ONLY anchor → the CHECK
aborted the DELETE → the whole retention sweep failed and NO expired chat was
ever purged (a silent RA 10173 retention stall).

Migration `20270920603512`: FK → `ON DELETE CASCADE` (an inquiry outcome with no
thread has no meaning). The sweep now converges. Full `test:db` replay 102/102.

SPEC IMPACT: None — retention-sweep convergence fix.
