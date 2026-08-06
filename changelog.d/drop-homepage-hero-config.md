## 2026-08-06 · chore(db): drop the retired sign-in hero's config table

Owner decision 2026-08-06: **"yes."** The sign-in hero was deleted 2026-08-02 —
its admin screen 404s — and this table is what it read.

**A drop is irreversible, so the boundary was verified against live production
immediately before writing it**, not inferred: 1 row · **0 `.from()` call sites**
anywhere in the app · 0 inbound foreign keys · 0 dependent views · 0 non-internal
triggers · 0 tests seeding it. The four remaining mentions in code are all
comments, and one of them says outright that the table is *"inert … deliberately
NOT consulted."*

🔑 **THIS REMOVES A WRITABLE PUBLIC ENDPOINT.** The exposure baseline shows `anon`
and `authenticated` held **SIUD** on it — select, insert, update *and delete* —
on a table serving a screen nobody can reach. Dropping it takes 18 lines out of
the exposure surface and adds none. That diff is the review.

Also updated, because the table is gone and nothing about it can be true any
more: the erasure map's `updated_by_admin_id` entry is deleted, and the table is
declared a deliberate exclusion in both guardrails. The export guardrail keeps
its key on purpose — the `CREATE` still sits in migration history so the scanner
keeps seeing the name — and the reason string now says that, rather than
implying the table exists.

**Verified:** full suite 6,925 pass under `Asia/Manila` · both coverage
guardrails green · 13/13 lint scripts clean · baseline regenerated in this PR and
reviewed line by line (18 removals, all this table; header counts only additions).

SPEC IMPACT: `DECISION_LOG.md` 2026-08-06 — recorded with the other owner decisions.
