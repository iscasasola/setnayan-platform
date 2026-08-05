## 2026-08-05 · change: face tagging is available on every event type

It was blocked outright on christenings and debuts. Owner ruling: it applies to
every event type we offer. It does now.

**What the block was actually for.** Not the honoree — at a christening the baby
isn't enrolling, and at a debut the eighteen-year-old is. It was the guests. At
both, much of the room is children, and the only thing between a child and a
face enrolment is a tickbox saying "I am 18 or older" that a child can tick. At
a wedding that's an edge case; at a debut it's most of the room.

**So it's a default now, not a refusal.** On those two types face tagging stays
off until an admin deliberately turns it on, and the confirmation says plainly
that the room is likely full of children, that the guardian-consent step doesn't
exist yet, and that the per-guest exclusion is the thing to reach for. Every
other event type is unchanged.

Everything else that protects a guest is untouched: enrolment is opt-in, nothing
is stored without consent and an 18+ confirmation, the host can exclude any
guest individually, and the couple can switch it off for their whole event.

Four tests that asserted the old rule were rewritten rather than removed, each
one saying what changed and why. A new test guards the warning text itself —
with the hard block gone, that warning is the safeguard, and softening it would
otherwise go unnoticed.

SPEC IMPACT: DECISION_LOG row — supersedes the christening/debut face-tagging
block; DPIA BV-8 guardian-consent workflow remains unbuilt.
