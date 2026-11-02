## 2026-08-28 · fix(event hub): the host's setup screen stops describing a wedding to everyone

Setnayan ships sixteen event types, including a funeral. The **guest-facing**
tree was threaded for all of them and holds it with its own guards. **The host's
setup screen was not.**

Five of the sixteen widget descriptions named a wedding outright, and
`website/widgets` — the screen where a host chooses what their guests will see —
prints them verbatim:

- *"Days to the wedding. Hides itself once the day arrives."*
- *"Your wedding-day run-of-show."*
- *"The wedding's load-bearing form. Always visible."*
- *"A space for the guest's tagged photos after the wedding."*
- *"A gallery of your own photos — engagement or pre-wedding shots."*

**A family arranging a wake read the word "wedding" five times while deciding
what their guests would see.** Nothing was broken; it simply spoke to somebody
else. 🔑 **And that page already resolved the event's own noun and used it in six
other sentences — the words were there and this one line did not use them.**

🔑 **THE FIX IS A SECOND WORDING, NOT A NEUTERED ONE.** *"Your wedding-day
run-of-show"* is the better sentence for a wedding, so it stays; `describe(noun)`
is consulted first where a second wording exists. A guard that simply banned the
word would have forced every type onto the blander sentence — so the guard asserts
**both** directions: no wedding wording for a non-wedding host, AND at least four
still saying "wedding" for a wedding.

⚠ **`our_photos` got no second wording, deliberately** — *"engagement or
pre-wedding shots"* has no wedding-flavoured version worth keeping, so its base
sentence is simply corrected for every type.

### 🪤 Two of my own mistakes, both caught by measuring rather than reading

1. **My first `our_photos` fix was decoration.** Its `describe` returned the same
   string for both nouns — a function that ignores its argument. My own rule
   ("every describe() actually changes the sentence") caught it on the first run.
2. **A mutation landed and stayed GREEN, and it was right to.** Neutering the base
   `description` changed nothing, because once an entry has `describe` the
   chooser never prints its base again — for either noun. That string had become
   **a stored value with no reader**, the exact shape this repo keeps paying for.
   Rather than delete it, it is now **pinned**: the base sentence must equal what
   the second wording produces for a wedding, so the two can never drift and
   editing one alone is red. Re-run after the rule: the same mutation goes RED.

**Verification:** typecheck **exit 0, 0 error lines** · `test:unit` **10,588 pass
/ 0 fail** · new guard 5 tests · **3 mutations measured before → after**, two RED
immediately and the third RED after the pinning rule it exposed.

⚠ **Scope, stated honestly:** this is the host's SETUP screen only. The Event Hub
itself already speaks each event's words to guests and to booked suppliers —
verified, not assumed. It is not the whole "friendlier across all events" job;
it is the measured part of it.

SPEC IMPACT: None — no rule, price or structure moved. Copy only.
