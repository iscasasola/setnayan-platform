## 2026-11-08 · feat(forms): phone autofill on every person field · "For · You" locks the celebrant to your own name

Owner, 8 Nov: *"if they already have a specific address saved on their account, or a specific name, or a specific
number … we accept also?"* and *"if it's for me, it cannot be edited out because it's a celebration for me, unless
they pick someone else."*

- **Autofill (Part A).** Every input that declares itself a person's email / phone / name / address now carries an
  autofill decision: the WHATWG token (`email` · `tel` · `name` · `given-name` · `family-name` · `street-address` ·
  `address-level2`) with a matching `type` / `inputMode`, or `off` where the details are not the typist's own
  (guest rows, sponsors, alaga, co-host invites, admin lookups, a supplier's client, a field merely named `name`
  that is not a person). Re-measured with the guard's own scanner on this branch's base: 64 person-data fields,
  14 with a token, 1 off, **49 with nothing** → 24 token, 40 off, **0 with nothing**. Profile's phone gains
  `type="tel"`; Help's "Your name" now starts from the account's name.
- **"For · You" locks the celebrant (Part B).** One shared part, `app/_components/self-celebrant-lock.tsx`: the
  celebrant field shows the account's own name, read-only, posting nothing (a blank honoree stays the account
  holder's own slot), with one quiet line "This event is for you · Change who it's for". Drawn on the create grid's
  inline form (Change re-opens For ▾ in place) and on every `/onboarding/[type]` wizard's celebrant screen (Change
  goes back to the For ▾ row on `/dashboard/create-event`, keeping `next`). Someone else keeps the shipped,
  editable name-or-link field. The in-place "Change" box on the wizard is retired in favour of For ▾.
- **Wedding.** Saying "I'm the bride / groom" with no couple carried seats the account's own first + last name in
  THEIR slot only (editable; never the partner's), and that slot offers `given-name` / `family-name`.
- **Guards.** `lib/person-fields-carry-autofill.test.ts` (scanner + own-data and other-person pins) and
  `lib/for-me-locks-the-celebrant.test.ts`, each sabotaged once. `create-for-whom` and
  `the-flow-stops-asking-what-it-knows` re-anchored to the lock.
- **Lab.** `/dev/onboarding-lab` takes `?self=<name>` and `?type=wedding`.

SPEC IMPACT: corpus `plans/autofill_and_self_prefill_2026-11-08/BUILD_BRIEF.md` (Parts A + B built); DECISION_LOG
row to be logged by the controller (the wizard's in-place "Change" becomes "Change who it's for" → For ▾).
