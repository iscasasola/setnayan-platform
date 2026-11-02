## 2026-08-24 · fix(privacy): the page stops promising an opt-out that does not exist

The live `/privacy` page told visitors our analytics had an "opt-out available in
your profile", in two places. **There is no such control** — no setting in the
profile or privacy screens, no column storing the choice, and nothing that could
read one. Verified by grep across every migration and lib before removing the
claim.

A right we advertise and do not provide is worse than one we never offered: under
RA 10173 the published notice is the promise, and this one named the exact place
to go. A person who followed it found nothing and had no way to know whether they
had succeeded.

**Owner ruled 2026-08-24:** take the sentence off now, build the real control
later. This is the first half. The control is scheduled into the tail wave with
the requirement that it have all three parts — something a person can find, a
durable place to store the answer, and analytics that actually honour it —
because a control storing a preference nothing reads is the same defect wearing a
different costume.

⛔ Nothing else on the page changed. The PostHog rows still declare the
processing itself, which is accurate and must stay.

SPEC IMPACT: None — `DECISION_LOG.md` 2026-08-24 already carries the ruling and
the finding.
