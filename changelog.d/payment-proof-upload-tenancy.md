## 2026-08-05 · fix(payments): the couple's order page and the vendor's fee page could not attach a payment photo at all

🚨 **A LIVE BREAK ON THE MONEY PATH.** Both screens file a payment screenshot
under `payments/<orderId>`. The upload guard added 2026-08-02 resolves the first
UUID in a prefix to an EVENT id unless the family is known — so it checked the
payer against a **wedding that does not exist**, found nothing, and refused. The
box turned red with *"That upload location isn't allowed."*

Fail-closed working exactly as designed, on a legitimate path. Nothing was
logged, there is **no other way to send the picture from those screens**, and
the form still submitted happily without one.

🔑 **WHAT IT ACTUALLY COST — THE SECOND CHANCE.** A purchase's FIRST screenshot
still arrived, because the buy-now drawer files under a different prefix. What
broke was resubmission: an admin pressing *"send me a clearer picture"* was
addressing someone who could not send one. That is the exact flow the owner
asked about on 2026-08-05.

`payments/` now resolves to an **order** tenancy and the route checks it against
`orders` through the caller's own client, so RLS still decides. Verified the
payer can read their own order (`user_id = auth.uid()`) — otherwise the fix
would have been an empty read, indistinguishable from the refusal it replaced.

🚨 **WHY THE EXISTING GUARD MISSED IT: ITS "REPO SCAN" WAS A HAND-TYPED LIST OF
SIX PREFIXES.** `payments/<orderId>` was never added, so the list stayed green
while the real call site was refused every single time — the textbook
two-hand-typed-things failure. **It is now an actual scan of the source**: every
`pathPrefix` a component passes must resolve to a kind the route can verify.
It reads 16 real prefix roots today. Mutation-checked both ways — reverting the
fix, and letting a kind the route cannot check slip through.

🔑 The old default's own comment said an event check "is the stricter one for
every current caller". True when written; this prefix made it false **without
changing a line of that file**.

SPEC IMPACT: None.
