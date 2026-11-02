## 2026-08-24 · fix(guest): the way back is one tap, and a named plus-one keeps their name

W2-A item 3, plus a **new live defect** found while doing Rule 0 on item 9.

### Item 3 — the product inverted its own reward

`/join/[eventId]/check-email` carried **no link of any kind**. Its only pressable
thing was the wordmark in the shared door shell — described there as *"the way
out"* — which goes to the marketing site.

Meanwhile the **same server action, one `if (email)` branch away**, redirects a
guest who *declines* to give an address straight onto `/{slug}`. So the person
who asked for an account got the worse ending than the person who did not. The
sharpest of the four callers is `claimAccountAction`, which runs from the *"Keep
this on your phone"* box **on the celebration page itself** — a guest standing on
`/{slug}` typed their email and was thrown off the page they were reading.

⚖ **Stated honestly:** the emailed link does eventually land them there
(`connect/route.ts`), so this was *"the way back is minutes away when it should
be one tap away"*, not *"they can never get in"*. The fix is sized to that.

⚠ **THE LINK IS GATED ON THE GUEST SESSION, NOT ON THE SLUG EXISTING.** Rendering
it whenever a slug resolves would turn this route into a **UUID → public-address
resolver** on a page that today discloses nothing about the event, and would
paint the action colour for a visitor it has never established will be admitted —
which on a private event delivers a lock screen, the same class of lie the fix
removes. All four callers mint or require a session for this exact event first,
so the gate costs a real guest nothing.

🔑 **The destination comes from the DATABASE, never from the caller.** Passing
`?slug=` in would be four edits instead of one AND would re-open the
open-redirect lesson `/[slug]/redeem` already paid for.

⛔ **The sibling's `/dashboard` fallback is deliberately not copied** — right on
`success`, whose visitor is signed in; this visitor is not, so it would bounce
them to `/login`, a worse dead end than the original. And *"You can close this
tab"* is dropped: it cannot stand beside a button asking them to stay. The
reassurance ("you're already on the guest list") is the true half and stays.

### 🔴 The new one: a plus-one who names themselves was still called "+ TBA"

`/welcome` exists so a plus-one can type their own name. It wrote `first_name`
and `last_name` and **never cleared `display_name`** — which for exactly this
guest is `'+ TBA · brought by {first}'`, and `guestDisplayName` **prefers
`display_name`** over first/last.

So the one screen whose entire job is to replace that placeholder left it
standing on the seating chart, in the emcee script and down the guest list. One
line. A test also asserts the placeholder is still **minted** — it is correct for
a +1 nobody has named yet, and deleting it at the source would leave a blank.

🛡 **5 mutations, all measured, all red:** the door deleted · the session gate
dropped · a slug accepted from the query string · "close this tab" restored
beside the button · `display_name` no longer cleared.

🪤 **One of my own assertions cried wolf first.** `!/searchParams[\s\S]{0,120}slug/`
fired on the innocent `let slug` declared a few lines below the `searchParams`
type. A guard that cries wolf teaches you to skim past the one time it is right,
so it now checks the two things that matter: the query-string **contract**, and
where the value is **read from**.

✅ typecheck clean · lint exit 0 · **test:unit 9711/9711**.

SPEC IMPACT: closes item 3 of `WHATS_NEXT_Guest_Activation_2026-08-22.md`
§ SECTION 2 and fixes one defect in item 9's shipped half. Item 9's remaining
build (a plus-one name box on the RSVP card) is still open.
