## 2026-09-09 · feat(services): a service card can publish without a Setnayan gift

The Setnayan gift stops being a condition of publishing a service card. Owner
ruling 2026-09-09: *"exclusive setnayan gift then should be optional."*

The rule was written in THREE places and relaxing any two ships nothing a person
can see: `PUBLISH_REQUIREMENTS`, the `enforce_service_publish_gate` database
trigger, and the maker's guided first pass — which held Continue until a gift was
typed and is the one a new shop meets first.

Compulsory would not have been a feature, it would have been a rate rise: the
gift is 40% of the booking fee charged on top of it, so fee + 0.4 × fee takes
what a shop pays us from 5% to 7% of the first ₱100,000, and makes the line we
sell against 25%-commission rivals with untrue.

`exclusive_perk_text` stays on the table and stays displayed. What is retired is
the REQUIREMENT, not the field.

SPEC IMPACT: applied — `DECISION_LOG.md` 2026-09-09 (the optional ruling) and
`SESSIONS_Chat_Bench_Exclusive_2026-09-09.md` row S10, both already committed to
the corpus.
