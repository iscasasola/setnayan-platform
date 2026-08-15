## 2026-08-15 · fix(shell): the create button says "Create" again

Owner, 2026-08-15: *"create button is gone."*

**It was not gone.** It sat in the same place, in the same gold, on every
signed-in surface — but it had been renamed `+ New event` earlier the same day,
in the same commit (`6f508ea59`) that fixed its destination after the owner's
*"create should allow me to create an event."* He scanned the top bar for the
word he knew and the scan came back empty.

Measured before touching anything: production (`784c411`) serves
`className:"fd-btn-gold",children:"+ New event"` in its live chunk, so the
control was demonstrably present and demonstrably renamed. Nothing was deleted
by the shell ports (#4442 · #4443 · #4444) — checked their diffs for removed
create controls and found none.

🔑 **A RENAME IS A REMOVAL TO WHOEVER WAS LOOKING FOR THE OLD NAME.** The href
was the only thing the owner asked to change; the label came along as an
unrequested side effect and cost a round trip.

- Label is now **`+ Create event`** — his word back, and still honest about the
  one thing the button makes. Deliberately not reverted to the bare
  `+ Create`, which is the label that used to point at the wrong page.
- The three sites that still *described* the old label are corrected in the same
  commit — the shell docblock, the CSS sizing note (now 14 chars, and it says
  the `white-space: nowrap` is what carries the longest label), and the
  create-event page's back-link note. *A correction at one site is not a
  correction.*

🛡 **New guard, both halves, mutation-proved with counts printed:**
`one-top-bar.test.ts` now asserts the bar renders a gold `Link` to
`/dashboard/create-event` **and** that its label carries `Create`. Run over
`code()` (comment-stripped) on purpose — the new docblock says "Create event"
four times, so a file-level substring match would have passed with the button
deleted outright. Mutation A (revert the label) 1→0, red on exactly the new
test; mutation B (delete the button) 1→0, red; restored 19/19 green both times.

⚠ **Named, not fixed:** the button is still `display:none` below 1024 inside the
app, so it does not exist on a phone. That is a deliberate, documented decision
about the phone's locked bottom-bar grammar — the owner confirmed he was on his
laptop, so it is not what he hit. On a phone, creation is still reached from the
events board's own composer and "New event" card, both of which render there.

SPEC IMPACT: None. Label copy on an existing control; no price, SKU, schema or
flag changes.
