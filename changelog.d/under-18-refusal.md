## 2026-08-05 · change: under 18 is a refusal, not a question

Owner ruling: "I am 18 or older" is the only enabler, and under 18 does not get
face tagging.

The tickbox already did the first half — nothing is stored unless a guest ticks
consent and confirms they're 18 or over. But a tickbox only records that we
asked. A fifteen-year-old at a debut can tick it.

So where the guest list already holds a birth date showing a child, face tagging
is now refused outright, whatever was ticked. Both places a guest can enrol —
at RSVP, and from the day-of card or a personal QR — apply it. A guard on one
path is a guard on neither.

Where there's no birth date on file, nothing changes: the tickbox is the gate,
which is the model as stated. This doesn't pretend to know more than it does —
a failed or missing lookup means "we don't know", never "they're an adult".

It can only ever refuse. Consent, the 18+ confirmation and the couple's
per-guest exclusion all still apply on top, so a wrong answer costs a guest
their automatic tagging — never costs a child their privacy.

Ages are counted as calendar days, not moments, because a date read as a moment
slips a day for readers west of us — and a slipped day can turn 17 into 18.

SPEC IMPACT: DECISION_LOG row — the guardian-consent workflow is superseded by
the 18+ attestation plus a known-age refusal.
