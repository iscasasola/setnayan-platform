## 2026-08-28 · feat(auth): signing in with nowhere to go back to lands on Events

Owner 2026-08-28: *"when you log in, you should go directly to Events (remove My
since event events of other people that you are invited will be here?)"*

**What a person gets.** You sign in from the front door and you are on your
Events board, not looking at the front door again. The menu entry above it reads
**Events**, not *My Events* — half the celebrations on that board are other
people's, and the word claimed them.

**Scope, stated because the other half is deliberate.** Only the bare `/`
changes. Anybody sent to sign in *from* a page — a shop they were reading, an
invitation, a deep link — still comes back to that page exactly as before. That
is the half of the 2026-08-13 decision this does not touch.

⚠ **IT DOES REVERSE THE OTHER HALF, AND THE OWNER ASKED FOR IT.** On 2026-08-13
the rule became *"`next` is honoured for EVERY origin, `/` included — signing in
from the front door returns you to the front door"*, written after he signed in
and was dropped on `/admin`. HQ is what he objected to; Events is the board he
has now asked for by name.

🔑 **ONE RULE, THREE DOORS — and the third door is why it is a module.**
`app/login/actions.ts` and `app/auth/callback/route.ts` each carried a
hand-copied `rawNext === '/'` line, and `DECISION_LOG.md` 2026-08-13 names that
duplication as the hazard in as many words: *"fix one and Google sign-in
disagrees with password sign-in: two answers to one question."* The front-door
panel arriving would have made three copies. `lib/sign-in-landing.ts` is the one
copy.

🪤 **IT IS NOT IN `lib/auth.ts`, WHERE `safeNext` LIVES.** That module opens with
`import 'server-only'` — so a CLIENT component cannot import it, and no
`node:test` file can either, because `server-only` is not installed in this repo.
The rule would have shipped untestable. The pure half lives on its own.

⛔ **THE SHARED PANEL MUST NEVER NAVIGATE, and the guard holds that in the
negative.** `SignInHerePanel` is opened from shop pages and guest flows to sign
somebody in *without* losing what they were doing; its own docblock calls
`router.refresh()` *"the whole seam in one call"* and names `router.push` as the
thing that throws a half-written enquiry away. Making the panel go to Events was
the shorter fix and would have silently broken every other caller. The front
door passes `onSignedIn`; the panel still decides nothing.

⚖ **VENDORS ARE NOT SPECIAL-CASED HERE.** `app/dashboard/layout.tsx` already
bounces a vendor account to `/vendor-dashboard`, so a second copy of that rule in
a second place would be the exact duplication this change exists to remove.

🛡 `lib/sign-in-landing.test.ts` — 7 assertions, every one mutation-checked with
the occurrence count printed before → after, all RED:
`signInDestination(` in login 1→0 · in the OAuth callback 1→0 ·
`onSignedIn`+`SIGNED_IN_LANDING` on the front door 1→0 · a `router.push` planted
in the shared panel 0→1 · the customer nav label renamed to something else · the
rule itself gutted 1→0. The panel mutation is an INSERTION, so its own needle
count does not move — the red is the measurement there, and the assertion it
breaks is the count of `router.push`, not of the line it was pasted before.

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-28 (supersedes the front-door-returns
half of the 2026-08-13 cold-sign-in row).
