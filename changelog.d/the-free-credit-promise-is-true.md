## 2026-09-14 · fix(papic): the free-credit promise names its condition, and falls silent when the allowance is off

**MONEY-1.** The public `/papic` page promised free credits **"on every
celebration"** in four places. Measured against `papic_claim_free_pool()` as it
runs in production (migration `20271208142357`, re-read live with
`pg_get_functiondef`), that is technically true and materially false: an
ACCOUNT claims the pool once, ever — `papic_free_grant_claims` has its PRIMARY
KEY on `user_id` and the arbiter is `ON CONFLICT (user_id) DO NOTHING`. The
first celebration gets `papic_event_pool_config.free_grant_points` (live value
**50**); every celebration after it gets a `free_grant` row worth **1 point** —
one photograph, a fencing floor so `papic_event_pool_status()` does not read the
event as unmetered. A row existing is not a grant.

Every free-credit sentence now derives from the admin column through one pure
resolver and names the condition: **"{N} free credits on your first
celebration"**. No literal anywhere in the copy.

🚨 **A second defect, found while building the "switched off" branch and NOT in
the brief.** `fetchPapicFreeGrantPoints()` folds *both* "the column says 0" and
"I could not read the column" onto the seed fallback of 50. So an admin who set
`free_grant_points = 0` switched the grant off in SQL — `papic_claim_free_pool`
returns before the claim — while the public page went on advertising **50 free
credits nobody would receive**, in a confident voice. That is strictly worse
than the "0 free credits" the brief forbids, and the page's existing `free > 0 ?`
guards were unreachable code. `fetchPapicFreeGrantRead()` keeps the three
outcomes apart and maps them exactly onto what SQL mints (`N → N` · `0 →
nothing` · `no row/unreadable → the same COALESCE(…, 50)`). The older helper is
now a thin wrapper over it with identical behaviour for its existing callers.

Deliberately NOT touched, and both are in the diff's reasoning:
- the **figure** at the hero badge — only its words changed, "N credits left"
  (a countdown, for a reader with no celebration) → "N free credits" (a size);
- the **admin label** `admin/pricing/_components/papic-rest-editor.tsx` ("Free
  credits on every event"), which sits beside the field that SETS the knob and
  describes the knob, not a customer promise.

Guarded by `lib/the-free-credit-promise-is-true.test.ts`, which pins BOTH ends —
the mechanism (read out of the live migration) and the sentence — plus the
switched-off branch **by render**, because a source scan cannot see what a
component returns.

SPEC IMPACT: None. No locked decision changes: the grant's size, its
once-per-account rule and the 1-point floor are all unchanged. This is the
public copy catching up with the mechanism shipped by PR #5192 / migration
`20271208142357`.
