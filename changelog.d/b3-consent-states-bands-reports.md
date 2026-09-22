## 2026-09-22 · feat(signup): CTRL-B3 remainder — agreement, dead states, bands, reports

### 2 — the Terms are agreed, not assumed

`/signup` carried **browsewrap**: *"By signing up, you agree to our Terms and Privacy"* as a footnote
**below** the submit button. No checkbox, nothing required, and **nothing recorded** — so there was
no answer to *"what did this person agree to, and when?"*, which is the only question that matters
if it is ever asked. Browsewrap is materially weaker in Philippine courts and under the NPC's
consent standard than a clickwrap the person performs.

Now: a required, **unticked** checkbox **above** the submit, matching the ruling the Stories box
beside it already obeys (commit `7f933ece1` — *"starts UNTICKED — affirmative consent, not
pre-selected"*).

🔑 **`required` is a hint, not a gate.** This is a server action reached by an HTTP POST, so a
hand-built form, a replay, or a browser with validation off all arrive with the field simply absent
— which is also exactly what an unticked checkbox posts. `signUp` refuses server-side.

The agreement is recorded in **two** columns: a timestamp alone says somebody clicked, not what they
agreed to. `TERMS_VERSION` is the effective date printed on `/terms`, and a guard fails if the two
drift apart. The migration **REVOKEs UPDATE** on both columns from `anon`/`authenticated` — RLS is
row-level and `users` is owner-updatable, so without it a person could stamp or clear their own
consent record with one PostgREST call. ⚠ **Not backfilled**: existing accounts agreed under
browsewrap, and stamping them would manufacture evidence for a click that never happened.

### 4 — `shortlisted` is bound to the switch that revives it

Prod holds `considering` 34 · `contracted` 14 · `deposit_paid` 3 — **zero `shortlisted`** — and its
only writer is behind `NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED`, absent from production. So
`one_option` and `searching` have never been rendered.

🛑 **Both of the brief's answers are wrong here.** Making it reachable is flipping a production flag
— the owner's decision, not a build's. Deleting the arms would **break reusable bookings silently
the day the flag flips**: it would mint `shortlisted` rows and the checklist would report
`not_started` about a category the couple is actively comparing.

So the coupling is made explicit and **executed**: `SHORTLISTED_REQUIRES_FLAG` and
`FLAG_DEPENDENT_STATES` name it in one place, and the guard asserts both ends — that no live status
can reach those states, that a `shortlisted` row does reach them, and that the writer still exists
behind the flag actually named. A dead branch nobody wrote down is the defect; one bound to its
switch is a feature waiting.

Guards: `terms-are-agreed-not-assumed.test.ts`, `the-checklist-cannot-reach-a-dead-state.test.ts`.
**11 sabotages red.**
🪤 One guard failed on its first run and was right to: it anchored on `type="submit"`, which this
page does not contain, and it refused loudly rather than passing vacuously — which is the only
reason the real error underneath was found. **My checkbox had landed where the footnote was, BELOW
the button, reproducing the exact browsewrap being fixed.**
