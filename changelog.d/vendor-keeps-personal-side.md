## 2026-08-15 · fix(vendor): opening a shop no longer takes away the events you already made

Owner, 2026-08-15: *"supplier/vendors also has their own user account. but they cannot make
from their vendor account."* Asked what should happen to the personal side, he chose
**keep both, block only creating.** Ruling recorded; it is not re-opened here.

🔴 **THE APP DID SOMETHING MUCH WIDER THAN THAT RULING.** Opening a shop flips an existing
customer's account to a shop account, and **nothing anywhere flips it back**. A layout
redirect then bounced that account off the ENTIRE couple tree — the events they had already
planned, each event's own pages, their profile, notifications, Alaala, People, Year. They
lost the wedding they had made, with **no way back**, and the account-deletion request lives
on the profile screen, so they could not close their account either — a right under
RA 10173.

⚠ **AND THE LIKELY VICTIM WAS NOT A SUPPLIER ONBOARDING.** "Create your shop" sits in the
account menu on **every** signed-in surface and on the couple's own events board — both
added 2026-08-10 specifically to put the wizard in front of couples. The person most likely
to lose their wedding was a couple mid-planning who accepted an invitation the product put
in front of them.

🚨 **THE DANGEROUS PART OF THIS FIX IS THE PART THAT LOOKS LIKE CLEANUP.** That redirect was
**the only thing enforcing the owner's ruling**. Removing it without moving the block would
have quietly repealed his lock, and nothing would have failed. So the block moves in the
same commit, to the four server entry points that actually create an event.

🔑 **AND THE OLD GUARD COULD NEVER HAVE HELD THE RULE ANYWAY.** Two of the four creation
paths commit from `/onboarding/*`, entirely outside `/dashboard` — so a shop account could
always have made an event through the wizard. The redirect only *looked* like the rule
because no shop account has ever existed to try it (prod: 0 shop-typed accounts).

- New `lib/vendor-event-creation.ts` — **one gate, not four checks**, asked by
  `createWeddingEvent` · `planNextYearEvent` · `commitOnboardingEvent` · `commitSimpleEvent`.
  It tests BOTH halves (the cheap label first, then real shop access) so an account whose
  shop was deleted is not refused forever — the same disagreement behind the 2026-08-10
  "more than 20 redirections" loop.
- **The refusal is a sentence, not a silent flick back.** The old behaviour was
  indistinguishable from a broken button, and nothing in the product tells a supplier that
  planning happens on a personal account. Deliberately never *"try again"*: retrying is
  exactly what cannot work.
- ✅ **No redirect loop returns** — that bug needed BOTH sides pointing at each other. The
  shop tree still sends a shop-less account here; this side now sends nobody there. Sign-in
  is unaffected (it stopped forcing vendors on 2026-08-13).

🪤 **THE COPY BROKE THE BUILD BOUNDARY ON THE FIRST CUT.** The sentence started life in the
`server-only` rule module, and the onboarding wizard that must display it is `'use client'`.
Split into a boundary-free module; `lint-server-only-boundary` passes (636 client files, 179
server-only modules, no crossing) and a test now pins it.

🛡 **Guard holds BOTH halves together** — the bounce is gone AND every creation path asks the
gate — because that pairing is the thing that can silently go wrong.

🪤 **And the guard cried wolf on correct code — the third time today.** It matched
`/server-only/` against the copy module's own docblock, which says those words four times
while explaining why it must not carry the boundary. Re-anchored to the import statement over
comment-stripped source. **Every one of today's three false alarms was the same mistake:
matching prose instead of the act.**

🔬 **Three mutations, restored 9/9 green each time:** M1 wizard loses the gate (1→0) → red ·
M2 blanket bounce restored → red · M3 create-event form loses the gate (1→0) → red, and
precisely discriminating.
⚠ **M2's printed count was 1→1 and is NOT a valid measurement** — the pattern matched a
different `*/` than the one it inserted after. The sabotage did land (the file changed) and
the RED result is what confirms it; the count is not evidence and is reported as such.

⏭ **Named, not fixed:** three controls on shop screens still start things a shop account
cannot do. Two are event controls now covered by the gate's sentence; the third —
"Create a Samahan" — is a shared GROUP, not an event, so the owner's ruling does not cover it
and hiding it would be a new product decision.

SPEC IMPACT: None — routing and an access rule on existing surfaces. No price, SKU, schema or
flag change.
