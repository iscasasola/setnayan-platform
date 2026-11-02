## 2026-07-30 · fix(ugat): restore joint J6 — and correct the brief that asked for it

J6 was in the corpus prototype and absent from the slice-1 port. Nothing in the code or git history explained why, and three independent design reviews flagged the gap. Restored.

**⚠ The request describing it was wrong.** The brief called J6 the "VENDORS↔THREADS money side". Verified against live production, `vendor_event_unlocks` foreign-keys to **`events`** and `vendor_profiles`. It is a vendor↔**event** bond. Restored against the schema, not against the request — and its claims now make that machine-checkable, so the wrong pair cannot be re-asserted later.

**What it documents.** The money side of vendor↔event access, distinct from J5 (the conversation) and J7 (the booking). `UNIQUE(vendor_profile_id, event_id)` — a vendor unlocks a given event once, ever. It carries a full refund path (`refunded_at` · `refunded_tokens` · `refund_reason`) and a separate `comp_reason` for admin-granted access, and it records `region_slug` + `band` at unlock time rather than re-deriving the pricing tier later.

**🚫 The trap, which is why the original prose needed rewriting rather than restoring.** Vendor token *purchase* was retired 2026-07-21, and the wallet has never had a real purchase. So `tokens_burned` is a currency nobody holds. Production carries **0 unlock rows, 0 burns, 0 comps**. The table is live plumbing for a switched-off mechanism.

Two ways that misleads a reader, both now recorded: a token cost here is **not** a current price, and an empty unlock table does **not** mean "no vendor has access" — access today comes from elsewhere; this simply isn't the path in use.

That is precisely why the plan's instruction was to re-verify the burn/hold prose rather than paste the prototype text back. The prototype predates the token retirement, and restoring it verbatim would have added a fifth stale claim to a registry we spent the day de-staling.

SPEC IMPACT: `DECISION_LOG.md` row — J6 restored as a vendor↔EVENT joint (not vendor↔thread as briefed); the token-burn mechanism is documented as dormant. No schema change, no RLS edit, no flag.
