## 2026-09-17 · fix(vendor): the first message to a supplier speaks the host's own occasion

🔴 One hard-coded sentence, duplicated byte-for-byte in two files, was sent for
EVERY celebration type:

> "Hi! We're planning our wedding and would love to hear about your
>  availability and packages for our date."

A birthday. A corporate booking. A trip. And a **WAKE** — a family arranging a
funeral introduced themselves to a florist by saying they were planning a
wedding and would love to hear about packages.

**The opening now comes from the event's PROFILE**, which already carries
`eventWord`, `organizerNoun` and `register` — so a new event type inherits the
right sentence from its row instead of re-opening this file. Same shape
`lib/guest-side-question.ts` used for the same family of defect (#5560).

### ⚖ The solemn arm is DRAFTED, not a noun swapped into the cheerful one

`register: 'solemn'` is documented in the profile as *"a TONE build across the
whole guest tree, not a row in a table"*. Substituting one noun would still say
"would love to hear" and "packages" to a grieving family — shopping language for
a funeral. The wake arm drops the exclamation mark, the enthusiasm and the
product-menu noun, asks the two things actually needed, and stops.

### 🔑 The guard asserts derivation, never a banned noun

A phrasing ban fails in BOTH directions: it misses a reword that makes the
identical mistake, and it convicts innocent code — a wedding SHOULD say
"wedding". So every case derives its expectation from the profile it passes in:

- each profile's opening contains **its own** `eventWord`;
- and **no other profile's** — the defect stated as a property, covering a new
  event type the day its row exists;
- the solemn arm is asserted structurally: the test generates the celebratory
  opening, substitutes the wake's noun, and requires the real solemn text to
  DIFFER from it;
- every opening still asks availability and cost, or it is polite and useless.

32 assertions executed, count printed. Sabotage: collapsing the solemn branch,
rewriting it as a noun swap, and re-hard-coding a greeting in a caller each red
exactly one test.

SPEC IMPACT: None — implements the existing solemn-register rule on the last
surface that had not read it.
