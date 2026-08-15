## 2026-08-16 · fix(vendor): a celebration put away by its couple still counts on the supplier's record

Owner, 2026-08-16, asked directly and answered **yes**: when a couple puts an event away, the
supplier's finished-jobs number and the review left for them **stay**.

🔴 **THIS IS THE COMPANION TO A BUTTON THAT SHIPPED HOURS EARLIER.** "Put this away" landed in
PR #4473 after two years in which `events.archived` had no writer at all. **Four** relations
quietly filter `archived = FALSE`, and none derives from the others — so **the first couple
ever to press the new button would have deducted their wedding from their photographer's
public count and taken the review with it.** Nothing would have errored. A number would just
have been smaller, on somebody else's shop page.

🔑 **A CUSTOMER MUST NOT BE ABLE TO EDIT ANOTHER BUSINESS'S HISTORY BY TIDYING THEIR OWN
LIST.** The person pressing the button is not the person it costs.

**What changed:** exactly one predicate removed from each of
`vendor_completed_events` (view) · `vendor_public_completed_events_stats` ·
`vendor_full_completed_events_stats` · `vendor_trusted_review_stats` (materialized).
In three it sits inside an `EXISTS (… WHERE e.event_id = …)` whose OTHER job is proving the
event exists, so only the archived line comes out. Every other predicate — voided-by-fraud,
the self-booking exclusions, comp grants — is preserved **byte for byte**: each block was
**extracted by script** from the migration that currently defines it and edited by script,
never retyped.

✅ **Verified before writing a line:** the four filters confirmed against production, and
`pg_depend` checked for dependent objects before dropping the matviews — **none**, so the
drops are safe. Indexes, `REFRESH` and grants restored exactly as their defining migrations
set them.

🔬 **The migration was REPLAYED, not just parsed** — 4 new db tests run against the real
schema in PGlite. Then the old filters were put **back** and all four went **red**, so the
tests genuinely hold the behaviour rather than describing it.

🪤 **AND THE SABOTAGE WAS STILL IN THE FILE AFTERWARDS.** My restore command ran from the
wrong directory and reported `No such file or directory`; the migration kept all four
re-inserted predicates. Caught by grepping the file instead of trusting the `cp`. **A restore
is a change too — verify it landed with the same rigour as the mutation.**

🔑 **Each test asserts BOTH directions.** "The count did not change" is free for a fixture that
never counted at all — so every case proves the row counts FIRST, then archives, then proves
it still counts. That before-check earned its keep immediately: it caught that reviews here
are **receipt-backed**, so a review with no booking behind it never counted and the test would
otherwise have "passed" while proving nothing.

⚠ **DATA EFFECT TODAY: NONE.** Production holds 0 archived events. This is correctness ahead
of the feature being used.

⏭ **Named, not fixed:** the three matviews have **no cron**. They are refreshed by hand from
the admin fraud screen, so a supplier's public numbers only move when an operator refreshes.
Pre-existing and unrelated to archiving, but it means these figures are stale by default.

SPEC IMPACT: None — no new column, no permission change, no price or SKU.
