## 2026-09-17 · fix(pabuya): an accepted moderator is recognised on their own celebration

⚖ **OWNER RULING 2026-09-17.** Asked whether the two definitions of "host"
should converge; answered yes.

Two definitions had diverged. The dashboard and the gift-QR route call an
accepted moderator a host (`userHostsEvent`: an `event_members` couple row, OR
an `event_moderators` row that is accepted, not removed, in a primary host
role). The disclosure rule saw only `event_members` couple|coordinator. So a
co-host invited as a moderator opened their own celebration's gift page and was
told *"Payment details are shown to invited guests"* — the product contradicting
itself about who they are.

🔑 **NOT A WIDENING TO STRANGERS.** The third arm admits exactly the people the
platform already treats as hosts, and it takes its answer from `userHostsEvent`
— the same function the other door asks — so this CONVERGES the two rather than
adding a third answer that can drift from both.

⚠ **It was still asked before acting.** It is a disclosure change, and
DECISION_LOG 2026-09-15 records why that is not a session's call: the
wallet-handle ruling was issued separately rather than inferred from the bank
one, because "widening a disclosure rule past what was asked is how the next
person inherits a decision nobody made".

🔢 Measured before the change: **6 accepted moderators, 0** of them without a
host member row. Nobody was affected yet, which made this the cheapest possible
moment to agree the rule rather than discover it.

⚠ **Fails closed.** The host lookup runs under the admin client (membership is
an event-level fact and a co-host's own RLS view can be narrower than the
truth), and a throw leaves `hostsEvent` false — recognition is what discloses a
bank account number, so the stricter answer is the safe one.

The test that previously PINNED the divergence and refused to resolve it now
records the ruling and the measurement instead.

⚠ Two of this suite's own assertions needed fixing, both in the TEST rather than
the code: one pinned `memberType` as the LAST property of the facts object, so
adding a third fact failed it against correct code — it checked ORDER while
claiming to check SHAPE.

SPEC IMPACT: a new owner ruling — recorded here; belongs in DECISION_LOG as the
2026-09-17 row converging the host definitions for disclosure.
