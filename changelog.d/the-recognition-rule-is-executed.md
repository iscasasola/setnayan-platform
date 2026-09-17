## 2026-09-17 · fix(pabuya): the disclosure rule is executed, not grepped — and the writes count their rows

**Steps 4–7 of the Pabuya plan.**

### The rule the owner gave twice was held by regexes over prose

`lib/pabuya-recognition.ts` is `import 'server-only'`, so nothing could import
it. Its only coverage was three `assert.match` checks over the file's own source
TEXT — a rename inside the function passed all three, and nothing under
`tests/` or `e2e/` mentioned pabuya at all. The rule protecting couples' bank
account numbers was guarded by string matching on comments and identifiers.

The decision now lives in the pure `lib/pabuya-recognition-rule.ts` and the I/O
stays in the `server-only` module — the same split `pabuya-qr-verdict.ts` /
`pabuya-qr-check.server.ts` already uses. 15 recognition decisions are EXECUTED,
count printed, including the `guest`-typed-row case that `host-scope.ts` records
as a live regression once.

⚠ `memberType` is threaded through as the raw string, never a `hasRow` boolean —
a boolean here would re-create that exact regression one layer up, where no test
could see it and the caller would look correct.

### ⚖ Two definitions of "host" exist, and that is now pinned rather than tidied

Recognition uses `isHostMemberType` (event_members couple|coordinator); the QR
route's host arm uses `userHostsEvent` (event_members couple, OR an accepted
moderator). They diverge both ways — an accepted moderator with no host member
row would have the account number withheld on their own event's page.

🔢 Measured in production 2026-09-17: 6 accepted moderators, **0** without a
matching host member row; 1 coordinator. Reachable by construction, nobody
affected today.

**Deliberately not converged.** Widening recognition to accept moderators is a
disclosure change, and DECISION_LOG 2026-09-15 records why that is not a
session's call — the wallet-handle ruling was issued separately rather than
inferred, because "widening a disclosure rule past what was asked is how the
next person inherits a decision nobody made". Narrowing the route instead would
lock a moderator out of their own dashboard thumbnail. A test now fails if
either definition moves without a ruling.

### A zero-row write no longer reports success

All six mutating calls in `pabuya/actions.ts` now `.select()` and count.
PostgREST returns no error when a filter matches nothing, so `!error` rendered
"saved" over writes that changed nothing — including **delete** and **hide**,
where a couple retiring an account was told it was gone while the row stood.
`STALE_ROW_ERROR` is distinct from the generic one because "try again" is wrong
advice for a stale page.

### The withheld sentence sees the QR

`identifiersWithheld` asked about the handle only. A QR-only method is legal
(`saveEgiftMethod` refuses only when BOTH are absent), so such a row withheld
its code in silence: a card with a rail name, no number, no QR and no reason —
byte-identical to a couple who filled the form in wrong. The gate was working
and looked like a defect, which is the one thing that sentence exists to prevent.

SPEC IMPACT: None — no ruling changes; the host divergence is FLAGGED for the
owner, not resolved.
