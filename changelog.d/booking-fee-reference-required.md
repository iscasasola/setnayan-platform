## 2026-08-06 · change(vendor): the booking-fee reference is now required — and the refusal box can no longer be forged

Owner decision, 2026-08-06: require the payment reference **on the vendor's
booking-fee form only**. The three customer-facing forms stay optional on
purpose — a guest blocked at the last step of buying photos does not go and find
their reference, they leave. The admin still approves every payment, unchanged.

Without a reference an admin matches by amount, sender and screenshot. That
holds until two vendors pay the same amount on the same day; then it is
guesswork, on money.

**Enforced server-side.** A `required` attribute is not a rule: the browser
accepts a single space, and a server action is a POST endpoint reachable without
the page at all. The check trims first, and sits **after** the ownership guard so
probing a stranger's order id still returns "not found" rather than revealing
that the id was real.

🔑 **NO FORMAT AND NO MINIMUM LENGTH, deliberately.** The 8-character code in our
own records is the one **we** mint for the vendor to quote. What they type here
is their **bank's** id — a GCash reference, an InstaPay invoice, a BDO
confirmation — and those share no shape. The six-character floor that exists
elsewhere is a downstream *matching* heuristic: a short id is harder to match,
not invalid. A regex or a length rule here would reject real payments.

🚨 **A LATENT INJECTION CLOSED IN THE SAME CHANGE.** The page rendered
`decodeURIComponent(search.error)` straight into a red alert. That was harmless
only because **nothing ever wrote that parameter** — a dead reader. This change
gives it a writer, so a crafted link could have shown a vendor any sentence at
all, in our own warning styling, on the screen where they send us money. Refusals
are now a fixed code→copy map; an unknown code renders nothing.

**Refuses by redirect, not `throw`.** The lane's older style throws, but
production redacts the message and the vendor lands on a generic console error
page with no idea what to fix.

🪤 **A guard of mine matched its own comment — the FIFTH time in one day.** The
test looking for the raw-render vulnerability was satisfied by the comment
describing it. The test file now strips comments before scanning, and says why.

🪤 **One mutation initially passed and shouldn't have.** Reverting the insert to
the raw form field still blocked blanks — the refusal above covers that — so
nothing user-visible broke. What it silently lost was the **trim**, storing
`"  GC-8842  "` with its spaces against a matcher that compares strings. Now
pinned.

**Verified:** 9 tests, every one mutation-checked (refusal removed · raw field
written · raw URL rendered again · trim dropped · length cap dropped) — all go
red. Full suite 6,902 pass under `Asia/Manila`; the 8 failures reproduce on
untouched `origin/main` (image decoding + vendor deep search) and are unrelated.
13/13 lint scripts clean; scoped `tsc` clean. No migration.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-06 — already recorded with the other nine
owner decisions.
