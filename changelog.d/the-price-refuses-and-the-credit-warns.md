## 2026-08-29 · fix(pricing,vendor): the price screen refuses a nonsense sign-up price, and a shop is warned before its credit goes

**Build 1 — the server refuses a bad sign-up price.**
`validateRetailRowFields` had exactly one rule on `onboarding_price_php`: blank,
or ₱0 or more. So the per-row catalog card would save a sign-up price ABOVE the
regular price — charging a customer more for buying during set-up — and would
put a Papic row under its 10% floor. It is now the only writer that ever could:
`saveFamilyDiscount` and `savePapicLadder` both DERIVE the sign-up price from a
range-checked percentage, so neither can express either mistake.

Two rules, deliberately scoped differently:
- **sign-up ≤ regular** — EVERY row, not just the two discount families.
- **the 10% floor** — Papic only (owner 2026-08-28: *"we will use the discount
  created for Papic Service Only instead of both"*). Setnayan AI answers to no
  floor; it carries its own, deeper discount.

The floor now REFUSES rather than warns (owner 2026-08-29), on BOTH writers.
`BLOCKING_COMPLAINTS` is the single list they both read — a money rule written
twice drifts, and this one previously existed as a browser warning on one path
and nothing at all on the other. Its old message literally promised *"this is a
reminder, not a refusal"*; that string is now asserted absent.

**Build 2 — a shop is told before its credit expires** (owner 2026-08-28: tell
them, *"before the money goes"*).

🔑 **The warning cannot live where the expiry lives, and that decided the whole
design.** Credit expires inside `sweep_vendor_tier_expiry`, which is
login-driven, so the visit that takes the money is the first visit after the
term ended. A notice emitted from there would arrive in the same page load as
the loss. The warning is therefore a SEPARATE, FLEET-WIDE sweep that runs while
`tier_expires_at` is still in the future — copying `maybeSweepExpiredCreatorOffers`:
any vendor's dashboard load sweeps every shop, so a shop that is not signing in
is still reached. That matters because the shops that lapse are exactly the ones
not visiting.

⚠ **The limit is stated, not hidden.** This project is cron-free. If nobody
loads a vendor dashboard during a shop's final week, nothing is sent — and
nothing is taken either, because expiry is login-driven too. Both are attached
to the same traffic on purpose, so a term cannot expire through a window in
which no warning could have fired.

The idempotency key carries the TERM's end date, so a renewed shop is warned
again next term; a per-shop key would have warned each shop once in its life.

🪤 **A phantom column, caught by measuring rather than by review.** The sweep's
first draft filtered on `vendor_profiles.tier`. There is no such column — it is
`tier_state` — and PostgREST refuses the WHOLE query for one unknown column
rather than throwing, so the sweep would have read zero rows, warned nobody, and
looked completely healthy. Read out of production before it shipped.

🪤 **One of my own tests was decoration, and it is now labelled as such.** A test
claiming to guard the `Number.isFinite` check on a malformed date could not fail:
`Date.parse` yields NaN and every NaN comparison is false, so the window
arithmetic already refuses it. The mutation stayed GREEN with the line gutted.
The test now pins the OUTCOME and says plainly that it does not pin the line;
the source comment says the same.

🔢 **Safe by arithmetic, measured 2026-08-29:** 2 shops, both Solo, **zero**
carrying any credit, **zero** ledger rows. This sends nothing to anybody today
and starts working on the first shop that carries credit into a final week.

Guards: 6 mutations on Build 1, 6 on Build 2, every one landed by measured
occurrence count and every one red except the decorative test above, which was
rewritten. The layout's cron-free sweep guard was UPDATED to six jobs rather
than loosened, so the new sweep is itself protected from silent removal.

Verified: `tsc` exit 0 (0 errors — the first run exited **134** with an empty
log, the out-of-memory abort that reads as a pass), lint exit 0, `test:unit`
11,370 pass / 0 fail, migration replay green.

SPEC IMPACT: Two owner rulings become code — the Papic sign-up floor is enforced
rather than advisory, and credit expiry is preceded by a warning. Add rows to
`DECISION_LOG.md` for 2026-08-29.
