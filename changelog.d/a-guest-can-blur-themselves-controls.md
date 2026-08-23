## 2026-08-24 · feat(privacy): a guest can blur themselves, and is told when somebody undoes it

Owner rulings 3 and 4 of 2026-08-17: *"Either side toggles it, freely — guest or couple, on or off"*, and because of that, *"the guest is notified if their blur is switched off"*.

**We promised a control and shipped somebody else's.** The live `/privacy` notice has always said: *"A guest who does not want to appear on an event's live photo wall can turn on FaceBlock… You can opt out of the live wall this way at any time."* Measured on `origin/main`: the only writer of `guests.faceblock_enabled` was the COUPLE'S per-guest editing screen, inside the organiser-only dashboard. A guest who did not want to be on the screens at their friend's reception had to **ask the couple to do it for them** — asking someone else's permission to be left off a wall.

The guest's own invitation page now carries the switch, next to the face-data notice that was already there.

⚖ **TWO CHOICES, DELIBERATELY NOT COLLAPSED INTO ONE.** *Blur my face on the screens* is reversible and keeps face matching finding their photos. *Remove my photo & face data* is "forget me" — it deletes the face data and pulls every auto-tag, and it is not reversible. Merging them would make the gentler choice cost a guest all their photos. The gentle one is listed first, because putting an irreversible action first invites using it by mistake.

**Ruling 4 is the counterweight to ruling 3 and is why it ships in the same change.** Letting either side move the switch means the couple can undo a guest's own choice — that was put to the owner as a risk and he took it deliberately, on the condition that the person it is about hears it from us. Switching a guest's blur from on to off now emails them, saying it happened and how to turn it back on.

⚠ **Only on the ON → OFF transition, and only when the previous value was genuinely read.** `prevGuest` is null on a failed read, and `?? false` would turn that into "it was off" and skip the notice on every save. The explicit `=== true` means an unreadable prior state sends **nothing** rather than something false — this is a message about somebody's face, and a wrong one is worse than none. A guard pins the comparison and separately asserts the `??` spelling is absent.

🔒 **A guest can only ever move their own switch** — same trust model as `withdrawFaceConsent` and `submitRsvp`: the guest session cookie must match BOTH the event and the guest.

**The current setting is read at render, not threaded down as a prop.** Either side may have moved it, so a value carried from a page that loaded before the couple flipped it would show the guest a switch in the wrong position — on a privacy control that is worse than no switch. The read fails toward "not blurred", which is the honest direction: the alternative tells a guest they are already blurred on the strength of a failed read. **The gate itself is in the database and is unaffected** — this value only decides which sentence and which button the guest sees.

🎨 The control uses `text-mulberry`, and the existing removal link moved off `text-terracotta` in the same pass. In this repo the slot NAMED `terracotta` is the atelier GOLD, which measures 3.37:1 as text — under the 4.5:1 floor — while the action colour lives in the slot named `mulberry`. Inherited and backwards, which is why the mistake keeps being made; a guard now fails if gold returns as text on this control.

Tests — `app/[slug]/_components/a-guest-can-blur-themselves.test.ts`, 8 assertions with an anchor that fails if comment-stripping ever reduces a file to nothing. **Five mutations, each measured by occurrence count, each red, each restored:** the blur form unwired (1→0) · gold back as text (2→0) · the guest session check removed (3→0) · the `??` default restored (1→0) · `faceblock_enabled` dropped from the select (1→0), which is the phantom-column shape where the notice would silently never fire.

🪤 **Naming this test file explicitly to `tsx --test` runs ZERO tests and exits green** — `[slug]` is a glob character class. It was written, run that way, and reported `# tests 0 # fail 0`. It must be run through a glob (`app/**/…`), which is how CI invokes it. That trap is already documented in this project and still cost a round trip.

SPEC IMPACT: `/privacy`'s FaceBlock paragraph becomes TRUE — it described a guest-side control that did not exist. Not edited here (public legal copy is published in the owner's name as DPO). Still owed from the same four rulings: extending blur from the venue wall to the public event page and the shared pool (ruling 1 says public means both).
