## 2026-08-15 · fix(onboarding): the last button always comes back — on every event type

Found while auditing *"how do we make creating an event effective?"* (owner, 2026-08-15).

🔴 **A PERSON ANSWERS NINETEEN SCREENS ABOUT HER DAUGHTER'S BIRTHDAY, PRESSES
"Create my birthday", AND THE BUTTON SAYS "Creating…" FOREVER.** No error, no retry,
nothing to tap. One dropped packet on a mobile connection and that is the end of it —
reloading keeps her answers but drops her back on screen one of nineteen.

`handleCreate()` in `onboarding/[type]/_components/generic-onboarding.tsx` awaited the
commit with **no try/catch**. `setCommitting(false)` lives only on the paths BELOW the
await, so a rejected server action — a 500, a serverless timeout, a dropped RSC
transport — left the pending flag locked forever. **React error boundaries do not catch
an unhandled rejection from an async onClick**, so nothing threw, nothing logged,
nothing noticed.

🔑 **THIS IS THE OWNER'S OWN 2026-06-03 BUG IN ITS SECOND COSTUME.** He reported it then
as *"never loaded"*. It was fixed that day — **in the wedding flow only.** The wedding
shell's catch still carries his report in its comment. This file serves **every other
event type** (birthday · debut · christening · anniversary · corporate · reunion · …)
and kept the defect for two months. *A fix applied to one route and not swept across
its siblings is half a fix.*

- The commit + the Turnstile mint are now inside a `try`, with a `catch` that unwinds
  the flag, shows a retryable message, and reports through the **same** `trackFailure`
  reporter the wedding flow uses — one failure, one place to read it.
- The success path deliberately leaves `committing` true: navigation is already in
  flight and re-enabling would invite a second event.

🛡 **NEW FAMILY GUARD — `app/onboarding/no-flow-hangs-forever.test.ts`.** It holds the
FAMILY, not the instance, so a third flow written next month is covered the day it
appears. Swept 2026-08-15: exactly **two** components manage their own pending flag
around an awaited commit. `<form action={…}>` callers (`onboarding/simple/page.tsx`,
`create-event/_components/event-type-picker.tsx`) cannot hang this way — React owns
that pending state — and a test asserts they still commit that way, so a conversion to
an imperative handler is caught rather than silently joining the family.

🪤 **THE GUARD CRIED WOLF ON CORRECT CODE ON ITS FIRST RUN, AND I ALMOST SHIPPED IT.**
It ended a catch body at `/\n\s{0,6}\}/` — which the `void trackFailure({ … });` call
*inside that very body* satisfies — so the body was truncated before
`setCommitting(false)` and **both** flows were reported broken while both were fine.
Replaced with real brace counting. *A guard that fires on correct code teaches you to
skim past the one time it is right.*

🔬 **Three mutations, counts printed before → after, each restored to 6/6 green:**
M1 remove the try/catch (the original defect) → 2 tests red · M2 catch stays but stops
unwinding the flag → **only** "the catch gives the button back" red, precisely
discriminating · M3 same sabotage on the *wedding* file → red, proving that member is
not vacuously covered.

SPEC IMPACT: None. Error handling on an existing flow; no price, SKU, schema or flag
change.
