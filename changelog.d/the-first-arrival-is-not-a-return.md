## 2026-08-21 · fix(event-hub): the first person to scan an invitation is not greeted as a returning visitor

The hub card's headline was an unconditional `Hi again, {name}.` — and the first
arrival mints the guest session and lands straight on this page, so it was
**literally the first sentence a guest ever read**. The comment above the card's
own mount even calls it *"for identified RETURNING guests"*, asserting a gate
that does not exist.

🔑 **The signal existed and had never been read.** `scan_events` is written by
every door that mints a guest session — four writers — and had **zero** product
readers. The greeting now keys on the guest's **earliest** recorded scan being
inside a short arrival window.

Why the earliest and not a count: the redeem route has been observed writing
**two rows 1.3 seconds apart for a single arrival**, so a count would lie where a
minimum does not — and a minimum does not move when the guest re-scans the card
in their hand.

⛔ **The two obvious shortcuts are the bug wearing a hat.** `rsvp_responded_at`
is stamped by three HOST dashboard paths with no guest session in sight (in prod
most guests carry it and have never scanned anything, because the couple typed
their answers in), and `arrived` is written only by the door crew. Either one
demotes a genuine first arrival straight back to "Hi again". A guard asserts
neither is consulted.

🔒 **"Hello", never "Welcome".** *Welcome* already means "you have checked in at
the door" in five other places; telling somebody sitting at home that they have
arrived at the venue is a different lie.

Other things it had to get right:
* ⏱ Two clocks — the scan is stamped by the database, the comparison runs on the
  app runtime. The window absorbs ordinary skew, and a database clock running
  ahead yields a negative difference that stays inside it, i.e. it fails toward
  the *new* greeting rather than the wrong one.
* 🔑 A rejected read is not a thrown error — unchecked, a lost grant would read
  as "never been here" and greet every returning guest as new.
* A blank name renders neither `Hello, .` nor `Hi again, .` — the sibling
  arrival greeting already guarded this and the headline did not.
* The prop is optional and defaults false, so every existing construction site
  is byte-unchanged and an unknown answer falls back to today's copy.

Tests: 8 (5 rendered, 3 on the signal). **8 sabotages, all landed by occurrence
count, all RED.** 9200 unit · typecheck · lint green.

⚠ Code-verified, not live-observed: the card renders only for a guest holding a
session, and prod has none to watch.

SPEC IMPACT: None — the wording is the owner's call and is raised in the PR body.
