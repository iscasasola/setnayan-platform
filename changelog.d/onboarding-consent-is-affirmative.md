## 2026-08-20 · fix(onboarding): the wedding door no longer consents for the couple to publishing their wedding

A couple who created their account inside the wedding onboarding flow was opted in
to having their wedding published on `setnayan.com/realstories` 30 days after the
day itself. The screen posted `<input type="hidden" name="public_summary_consent"
value="yes" />` — no checkbox, no sentence, nothing on screen to decline and
nothing that said it had happened.

**The ruling already existed and this door missed it.** Commit `7f933ece1`
(2026-07-12) settled how this exact field is collected: the box "starts UNTICKED —
affirmative consent, not pre-selected". `/signup` has honoured that since it was
built, as a real checkbox beside copy explaining what opting in means. Nothing
noticed the second door: FormData carries whatever is posted, so a hidden field
typechecks, lints and renders exactly like a correct one, and the only symptom is
a consent nobody gave.

**Deleted rather than re-drawn as a checkbox.** The Google button directly above it
on the same screen posts no consent field at all, so silence is already what this
screen says on its other path; and the couple has two shipped places to opt in
deliberately and reversibly (Website → Privacy, Website → Editorial). Consent taken
without a sentence explaining it is not consent, and this screen has no room for
the sentence.

**Measured before acting:** prod holds 9 users and **0** with
`public_summary_consent_at` set, so nobody has been published under this and no
data needs correcting. The door was open, not yet walked through.

Guard — `app/signup/consent-is-affirmative.test.ts` sweeps **every** `.tsx` under
`app/` rather than naming the one file, because the rule was already written down
and already obeyed in one place; what was missing was anything that noticed the
second place. It fails when this field is posted from anything that is not a
checkbox, when a checkbox is pre-ticked, and — the vacuity arm — when no file
collects it at all, so a rename cannot turn the guard silently green. Comments are
stripped before matching: the corrected file carries a note naming the string it
removed, and a raw-source scan would report the defect it just fixed, forever.

Mutation-checked by occurrence count, all three landing and all three red:
restoring the hidden input (0 → 1), pre-ticking the signup checkbox (6 → 7), and
renaming the field away (1 → 0). Baseline green after restore.

SPEC IMPACT: None — this enforces the existing 2026-07-12 owner ruling on an
additional surface; no decision changes.
