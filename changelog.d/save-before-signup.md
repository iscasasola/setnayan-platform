# Save a supplier before you have an account

## 2026-08-13 · feat(explore): a stranger can keep a supplier they just found

**SPEC IMPACT:** `DECISION_LOG.md` row 2026-08-13. Owner, asked directly
whether a signed-out visitor should be able to save a supplier: **"show it."**

### What was wrong

The marketplace card rendered Save only when
`bookable && isAuthenticated && eventId`, and the comparison table passed
`canSave={user !== null && coupleEventId !== null}`.

So **the one person most likely to want to keep a supplier — someone who has
just found one and has no account yet — was the one person who could not see
the button.** We asked for the account before giving anybody a reason to want
one, and offered nothing to come back to.

It also meant the seam's own headline journey, the one the approved prototype
demonstrates — *signed out → open a shop → press Save → sign in → still there,
"Saved"* — **was not reachable in the shipped product**, because the first
press had nothing to press.

### What happens now

Save appears to anyone. Pressing it signed out opens the sign-in **over the
marketplace** — the page, the scroll position and the supplier all stay — and
once they are in, **the save they already pressed runs itself**. One press
means one save, not a press followed by a round trip followed by remembering
to press again.

`bookable` still gates it: a supplier finishing verification cannot be saved by
anyone, and offering it would be a fake door.

### The state nobody had designed for

Signing in is not the end of the journey. **A brand-new account has no event**,
so the save action refuses with `no_primary_event` — and the old handling put
that in the red `error` state as the sentence *"Create an event first to save
vendors."*

That is a dead end at the exact moment somebody has done everything we asked.
It is now its own state and renders as a **doorway** — *"Start an event to
save"* → the board — because the supplier they picked is not lost, it is one
press away on the other side of starting a plan.

### `canSave` is retired

Every call site now passes true. **A prop that every caller answers the same
way is not a choice, it is a lie about there being one** — and this one had
been the thing hiding the button from strangers. The gate that remains is
`bookable`, at the call site, where it means something.

### Guard

`app/explore/_components/save-is-open-to-strangers.test.ts` — five assertions,
**all six mutations applied by occurrence count and all caught**, baseline and
restored green. It pins: the card and the comparison table both offer Save
without an auth condition, `bookable` survives as the real gate, no call site
passes `canSave`, a signed-out press opens the panel **and hands it the
retry**, nothing navigates away, and the no-event case is a doorway rather than
a sentence.

🔑 **This regresses silently if it regresses at all.** Re-adding an auth
condition does not error, does not warn, and reads like tightening a
permission — and every signed-in developer keeps seeing the button, so nobody
notices it has vanished for everyone else.

### ⚠ The one thing CI must answer

This makes `explore`'s route chunk an importer of the sign-in panel. When the
seam shipped, adding this same consumer coincided with the shared bundle going
over its locked 200 KB ceiling — but that measurement was taken alongside a CSS
change, so **the cost was never cleanly attributed to this button.** `main` now
sits at 199.8 KB with 0.2 KB of headroom.

If the bundle check trips, the button stays and the bytes come from elsewhere —
the owner has ruled on this journey, and the budget is a constraint on how it
ships, not on whether.
