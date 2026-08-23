## 2026-08-23 · feat(event): the celebration's own page carries its photograph

The account home has shown a picture of each celebration since 2026-07-30 (owner: *"we want a
better card for events… let them get to imagine what the events are"*). Opening the celebration
itself then dropped to a card of pure text — the one screen a couple lives in was the one with
nothing of theirs on it. The focal card now leads with the picture.

🔑 **Nothing was drawn.** `EventScene` already ships and already owns the whole precedence — the
couple's OWN hero photo untouched, else the per-type stock photo under a per-event treatment, else
a deterministic branded gradient. It is reused, so the celebration's page and its card on the home
board can never disagree about which picture an event has.

🔒 **"One obsidian per view" is untouched.** The band sits INSIDE the existing dark card rather than
becoming a second dark surface, full-bleed within the tile's own padding, and `.sn-tile-dark` — a
shared class with seven consumers across the app — is not restyled from here. The picture dims with
the card once the celebration has passed.

⚠ **Fail-soft in both layers.** A vocabulary read that throws falls back to the repo asset; a
`landing_page_hero_image_url` that will not sign, or is not an image, is narrowed away before it can
reach an `<img src>` — that column is host-writable straight through PostgREST. Worst case the
branded gradient renders, never a broken frame.

---

🛑 **THE SECOND DELEGATED CALL — "one event card on phone and laptop" — IS NOT BUILT, AND THAT IS
DELIBERATE.** The delegation says these are reversible calls, not owner locks, and that a call which
looks wrong when the file is opened should be said out loud rather than protected. Opened and
measured:

- `GlassEventCard`'s own docblock reads **"One EVENTS glass card (owner-approved final design
  2026-07-15)"**.
- `MobileEventHero` cites the prototype it came from by name (`proto .mhero`), and `MobileEventChip`
  the same.
- An earlier pass in this same stream had already measured the split and recorded that it is
  deliberate and comes from an approved prototype.

Unifying them would replace two owner-approved compositions with one nobody has approved. That is a
design reversal wearing the clothes of a consistency fix, and it needs the owner, not an engineer.
**Owner call, one question: do you want the phone and the laptop to show the same event card, given
that both current designs were signed off?**

6 sabotages, every one measured by occurrence count before → after, all red. One did not land on the
first attempt (1 → 1, a `{false && …}` that left the element's name in the file) and was re-run as a
real removal — an unmeasured mutation proves nothing.

SPEC IMPACT: None. No migration, no schema, no price or SKU change.
