## 2026-09-10 · feat(admin): the verification desk — a result per check, and the reviewer can open the paper

**What a person can now do.** Opening a shop in the verification queue shows a
result for every check the machine can make, one line each. A check that
disagrees names *what disagreed with what* — both values, and where each came
from — instead of saying "needs review". A check nobody could decide says so,
and says whether that is because a source did not answer or because it was
always going to be a person's job. Four clean checks and one mismatch is
four-fifths done: the reviewer opens only the fifth. And they can now **open the
documents**, from the checklist, for the first time.

### Owner ruling this implements (2026-09-09)

> *"we need to be informed which on the verification needs manual checking. the
> rest will be automatic unless all needs manual. we want an automation to also
> tell us if there are mismatches."*

⇒ **THE UNIT IS THE CHECK, NOT THE APPLICATION.** "All manual" is not a mode —
it is simply the case where every check happened to land on a person. There is
deliberately **no overall verdict anywhere on the desk**: a single "ready /
not ready" pill is what a tired reviewer reads *instead of* the ten results
underneath it, and it would quietly restore the one-click approval this desk
exists to put evidence behind.

### Two measured defects, fixed together because either alone dead-ends

🔴 **THE REVIEWER COULD NOT OPEN A SINGLE DOCUMENT.** The checklist drawer drew a
tick per slot and nothing else; the only opener in the product lived on
`/admin/verification-docs`, a storage-hygiene page listing raw R2 keys with no
idea which application they belonged to. **An automated mismatch report that
escalates to a human who cannot see the paper has escalated to nowhere.**
🔑 RULE 0 paid: nothing was invented. `r2SignedGet` + `contentDispositionAttachment`
are exactly what that page's own `viewVerificationDoc` already uses, 120-second
life and `attachment` disposition included.
⚠ **And the key is re-derived from the application, never trusted from the form.**
The hygiene page gates on `is_internal`; this queue admits `is_internal ||
is_team_member || account_type = 'admin'` — a strictly wider room. Handing that
wider room a reader for *any* key in the government-ID bucket would have been a
silent widening of who can read a stranger's passport.

🔴 **A ONE-CLICK "Approve → Verified" GRANTS THE BADGE WITH NO DOCUMENTS — AND IT
IS THE ONLY VERIFICATION PATH PRODUCTION HAS EVER USED.** Read out of prod
2026-09-09, by the object: **two shops, both `verified`, every identity column
NULL** (`registered_business_name` · `registered_address` · `registration_number_raw`
· `tin_number` all null); **one** `vendor_visibility_change` audit row, whose
timestamp matches one shop's `last_verified_at` to the tenth of a second; and the
only verification application ever created is **still a `draft` with two empty
slots**. The applications queue has never decided anything.

### The fence covers all THREE grant doors, and the third one is now reachable

⚠ `app/admin/vendors/verification-bypass-actions.ts` (PR #5298, merged 2026-09-07)
writes `verification_state` directly and **had no admin surface at all** — its
only references in the repo were its own unit test and the generated admin-jobs
inventory, and `vendor_verification_bypasses` holds zero rows.
**DECISION: covered, and MOUNTED.** Of the three doors, the vouch is the *most*
accountable — a mandatory written reason, an audit row, and a six-month deadline
a sweep enforces. Leaving it unreachable never prevented vouching; it pushed
every real vouch through the plain Approve button, which records none of that and
expires never. That is how production ended up with two verified shops and no
paperwork. Mounting it completes merged, owner-ruled work; the rulings it carries
(same badge · no cap · 182 days) are untouched.

All three doors now write an `evidence_at_grant` snapshot — what the checks found
at press time — into their audit row. **The guard that pins this DERIVES the door
list by asking which code writes `verified`,** so a fourth door added tomorrow
fails the test until it is covered; a hand-written list is a list of the doors
somebody thought of, which is exactly how the bypass shipped outside every fence.

### ⚖ THE BUTTON WARNS; IT DOES NOT REFUSE — and that is the owner's ruling to make

Offered "refuse with an override", he did not take it — he answered with the
automation instead. So the grant dialog now names, in the same breath, what was
not checked; nobody can press Approve while *believing* the paper was checked.
**Whether it should hard-refuse is in the PR body as the one open decision.**

### 🔒 Fail toward manual, per check

Unreadable, undecidable, or a source that did not answer marks **that** check
manual — never a pass, and never a failure of the other nine. The DTI registry
returned 504 twice on 2026-09-09, so *unreachable is a normal condition*: the
registry seam exists, returns `not_attempted` today, and both `unreachable` and
`not_attempted` land on manual with a reason rather than quietly implying the
number was verified.

🔑 **`r2Head` could not support this and a new sibling was needed.** It answers
`null` for a missing object, a 403 *and* a network blip alike — correct for its
own job (a custody proof before an irreversible delete must fail closed on all
three) and useless for the opposite question. `r2HeadOutcome` claims `absent`
only on an explicit 404; everything else is `unknown`. Telling *"the checklist
says the permit is filed and there is no file behind it"* from *"storage did not
answer"* is the whole difference between a real finding and an invented one.

### Fixed in passing

The checklist drawer said **"12-doc checklist"** while `DOC_SLOTS` has held
**eight** since the 2026-07-03 prune. Derived from the array now.

**SPEC IMPACT:** `DECISION_LOG.md` — 2026-09-10 row recording the per-check
verification desk, the three-door evidence record, and the mounting of the vouch
grant. No schema change; no migration.
