## 2026-09-06 · feat(moodboard): a booked supplier SUGGESTS its reception zone — and never writes it

Owner ruling 2026-09-06 (Q9): when a couple has already booked a live band, a
mobile bar or a photo booth, the reception zone that would show it **suggests**
it. It does not apply it.

A couple could book Manila Strings, Kuya Mike and The Gin Cart in the
marketplace, open the reception designer, and find no connection between the two
— every zone reading "not chosen yet" with no hint that they had already hired
someone whose work belongs in it. Now the zone rail marks those zones and the
open zone says *"You've booked Manila Strings and Kuya Mike — their work would
show up here. Choose what you want and it appears in your room."*

🔑 **The ruling is enforced by the return type, not by discipline.**
`lib/reception-booked-suggestions.ts` **cannot** produce a `ReceptionDesign`: it
does not import one, and its result carries no option id at all — only which
zone and which supplier. Clicking opens the zone so the couple chooses; there is
nothing there to pick with. A guard reads the module's own source (through
`stripComments`, so it does not accuse its own docblock) and fails if the design
vocabulary ever appears in it.

Why that matters: `sel()` falls back to `DEFAULT_DESIGN` for any part a stored
design has no key for, so a written-in suggestion is indistinguishable from a
choice the couple made. They would find selections they never made, and deleting
one could not stick. Same reasoning that made every celebration zone default to
`none`.

🔑 **And there is no second mapping.** The zone→trade question is already
answered by `canonicalServicesForPart`, which the Ask button and the finalization
screen use; a supplier's `vendor_profiles.services` is already in the same
canonical vocabulary. A suggestion is an INTERSECTION of two things the page
already loads.

🪤 **The trap this cost:** the render-part namespace is `room:<zone>`, not the
bare zone id. The first version passed `'program'`, got an empty list, and
produced **zero suggestions for every couple** — silently, because an empty
result is exactly what "booked nobody for this zone" looks like. No type could
see it; running it on real bookings did. Pinned by a test.

🪤 **An existing prop-chain guard required `finalizedByPart` to be the LAST
destructured prop** (`/finalizedByPart,\n\}: Props\) \{/`) and went red the
moment a second prop was added after it — accusing correct wiring. "Is it last"
is a cheaper proxy for "does the editor accept it"; it now reads the signature.
The same chain is now asserted for `bookedByZone`, hop by hop, because a
resolver with no consumer is the defect MB14b shipped ten rows of.

SPEC IMPACT: None.
