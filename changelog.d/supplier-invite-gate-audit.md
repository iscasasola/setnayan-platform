## 2026-11-04 · fix(supplier-doors): five small breaks found by the supplier-invite gate audit

Audit of the five flows in the owner's 2026-11-02 ruling "THE MINIMUM TO LET SUPPLIERS IN" (full report in the PR body).
Only the small, clearly broken things are fixed here:

- **`/signup` keeps a supplier a supplier after a refusal.** Every retry redirect in `signUp` (unticked box, short or
  breached password, Supabase error) dropped `as=vendor`, so the supplier came back to the couple sign-up and the retry
  made a couple account. All retries now go through `signupRetryPath`, which keeps it.
- **Team member "create your own"** on `/vendor-dashboard` pointed at `/signup?as=vendor`, which sends a signed-in
  visitor straight back. It now opens `/open-shop`.
- **`/open-shop` page and `becomeVendor`** dropped the error on the own-shop read. A refused read looked like "no shop":
  the page re-opened the wizard over a named shop, and the action tried a second insert and showed raw duplicate-key text.
  Both now keep the error (the page throws to the error screen; the action returns with a plain "try again").
- **Inspiration box** (`/vendor-dashboard/moodboard-library`) showed a refused uploads read as "No uploads yet". It now
  throws to the dashboard error screen.

Guard: `apps/web/app/signup/a-refused-supplier-signup-stays-a-supplier.test.ts` (each fix sabotaged → red, restored →
green). `terms-are-agreed-not-assumed.test.ts` now also accepts the refusal spelled through `signupRetryPath`.

SPEC IMPACT: None — restores the behaviour the shipped code already intended.
