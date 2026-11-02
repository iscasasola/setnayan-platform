## 2026-08-04 · feat(admin): the switch that turns face auto-tagging on

The face-recognition models were activated in June and have been storing
nothing ever since. Every event sat in the safe mode where a guest's face
fingerprint is thrown away the instant it arrives — and **there was no control
anywhere in the app to move an event out of it**. Not for a host, not for an
admin, not in a script. The feature was on at the app and off at the wall, with
no switch in between.

There is now a switch, per event, on the admin events list. Owner decision:
on.

**What turning it on does, precisely.** A face fingerprint is kept for a guest
who has ticked biometric consent, affirmed they are 18 or over, and whom the
couple has not excluded. Nobody else — that was already true, and stays true.
What changes is whether a consenting adult's fingerprint is kept instead of
discarded.

**What it cannot do.** Christenings and debuts stay off whatever the switch
says, because no guardian-consent flow exists for them. The switch is
admin-only, deliberately: it is the biometric gate, and the DPO makes that call
per event, on the record.

Also corrected the note on that column, which claimed turning it on would
fingerprint *"every guest with no per-guest opt-in roster."* That was untrue —
consent has been required on both enrolment paths for months — and it is the
reason the switch stayed shut.

SPEC IMPACT: DECISION_LOG row added — face auto-tagging enabled per event by
admin, 2026-08-04, owner decision.
