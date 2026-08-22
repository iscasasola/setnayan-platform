## 2026-08-21 · fix(event-hub): the invitation tells the truth, and no tab ejects a guest

Owner: the invitation page is *"where people will accept and register their
details for the host"* and *"this will help the host of the event manage their
guest lists."* So every defect here is ranked by one test — does it stop a guest
completing their record, or make us say something untrue while they decide
whether to trust us?

* 🔴 **We promised a deletion we do not do.** The access card read *"See your
  tagged photos for 3 days"* and *"Photos delete from your view after 3 days
  unless you sign up."* **There is no 3-day mechanism anywhere in the product**,
  and "delete" contradicts the standing lock — photos are compressed, never
  deleted, and the gallery is kept for life. It applied false pressure at the
  moment a guest decides whether to trust us. Replaced with what is true, in the
  words the sibling card in `site-body.tsx` already uses: the accountless guest
  VIEW winds down about a day after the event; the photographs are untouched. A
  test pins the two cards to the same wording so they cannot drift.
* 🚨 **A tab took guests off the event with no way back.** *Camera* renders live
  for an unidentified visitor and lands on a refusal — *"Open your invitation
  first… then come back here"*, said to someone standing on the invitation —
  whose only link went to Setnayan's marketing homepage.
  🛑 **THE OBVIOUS FIX WAS WRONG AND A PRE-EXISTING TEST CAUGHT IT.** Requiring a
  guest session before the tab goes live repeals an owner ruling that
  `site-nav.test.ts` pins in as many words: *"for everyone else the HOST'S SWITCH
  is the gate."* The gate was never the defect — the DESTINATION was. The camera
  link now carries the event, so the refusal hands them back their invitation.
  🔒 The incoming value is pattern-checked and used only as `/${slug}`; taking it
  as a path would be an open redirect on the most-shared link in the product.
* **The labels a guest scans were the faintest text on the page** — measured
  3.37:1 on cream, 3.08:1 on the plates, 2.97:1 on the veil, against a 4.5 floor.
  The design's own rule already said gild is decor-only and "below ~0.85rem use
  text-ink/70"; this rule is 0.66rem. The metal MOVES rather than disappearing:
  the № numeral and the ✦ star keep it (both `aria-hidden`, so they carry no
  meaning), as does the rule line.
* **Every event asked its guests to write to "Maria & Juan"** — the note box's
  placeholder was hardcoded to a sample couple while the label one line above
  already used the event's own words. Even the seeded sample is Maria & *Jose*.

Tests: 9 new. **13 sabotages, all landed by occurrence count, all RED** —
including three separate ways of re-breaking the camera and one that repeals the
owner ruling.

🪤 **THREE of my guards this session were fooled by PROSE** — a docblock that
names the string it forbids satisfies a raw match. There is now one `code()`
helper that strips comments before any source scan.

SPEC IMPACT: None — the photo copy is brought into line with the existing
retention lock rather than changing it. A `DECISION_LOG.md` row is appended.
