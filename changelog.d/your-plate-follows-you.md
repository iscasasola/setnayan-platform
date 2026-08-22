## 2026-08-21 · feat(account): your meal and your allergy follow you, not the event

Owner: *"let's add those [that] doesn't exist… if they create an account to sync,
these information will be saved on their account automatically, and the event
they joined will be their first event."*

**RULE 0 — the second half already ships.** The account-claim bridge's own
docblock says it turns a name on a list into an account *"with THIS event
already attached"*, and it writes the `event_members` row. Nothing rebuilt.

What did NOT exist: the answers themselves. A guest types their meal and their
allergy on every invitation they accept, and the answer died with that one
event. Now:

* **`public.users` gains `meal_preference` + `dietary_restrictions`** (+ a
  consent stamp). Follows the religion / civil_status / sex carve-outs exactly —
  optional, reference-only, idempotent.
  🔑 **Reuses `public.meal_preference`**, the SAME enum the guest row uses. A
  parallel list drifts the moment one side gains a value, and the entire point
  is that one fills the other. `MEAL_PREFERENCES` is now DERIVED from
  `MEAL_LABELS` so the validator and the labels cannot disagree.
  ⚠ **Dietary text is HEALTH DATA under RA 10173** — allergies, coeliac,
  religious restriction. It carries a per-field consent timestamp, stamped on
  first value and cleared when emptied, exactly like `religion` beside it.
* **On account claim the answers come with them** — in `linkGuestSessionToUser`,
  the one place a name on a list becomes a person with an account.
  🔒 **Fills blanks only.** A guest row from a wedding two years ago must never
  replace the allergy they corrected last week.
* **The reply card offers them back** as a DEFAULT where this event's own answer
  is blank — never as an override, because the answer given HERE is what the
  caterer cooks from.

🔴 **A BUG CAUGHT IN MY OWN REVIEW, AND IT IS THE ONE THAT MATTERS.** The first
cut carried both fields in ONE update with both `.is(…, null)` guards, which
ANDs them — so a profile that already had a meal preference matched nothing and
**the allergy was silently dropped**. Two statements now; each lands on its own
merits, and a db test asserts exactly that case.

Tests: **7 db tests against a real Postgres replay** — not a source guard,
because the load-bearing behaviour is a WRITE CONDITION and a grep passes on a
comment (and passes just as happily when the two statements are merged back).
Both `guestIdentity` key-set guards updated deliberately, with the reasoning in
the diff as their own comment asks.

SPEC IMPACT: None — extends the existing self-profile personalization carve-out.
A `DECISION_LOG.md` row is appended.
