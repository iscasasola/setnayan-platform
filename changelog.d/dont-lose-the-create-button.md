## 2026-08-21 · fix(marketing): signed in, the create button came back

Owner, within the hour of the feature going live: *"i lost the create button on
my page."* He is right, and it was my reading of his own ruling that caused it.

**"Start planning · free" IS the create button** — the same label and the same
`/onboarding/...` destination on all seven service pages. `AddToEventCta`
SWAPPED it for "Add to an event" when signed in, so a signed-in person could no
longer start a celebration from the page at all. Creating still existed, one
click deep inside the dialog, which is not the same as being on the page.

🔑 **"THE ONLY DIFFERENCE IS ADD TO AN EVENT BUTTON" MEANS THE PAGE GAINS ONE.**
It never meant it trades one away. I read a sentence about an ADDITION as a
description of a REPLACEMENT, and the guard I wrote then pinned the wrong shape
— it asserted the swap, so it would have defended this defect forever.

**Now signed in renders BOTH:** the picker as the primary action, because
somebody who already has celebrations usually wants to add rather than start
another, and the create link beside it in the quiet style — same href, same
label, one press away. Signed out is unchanged, as it has been throughout.

🛡 The guard is inverted to match: `signed IN keeps the create button` replaces
the assertion that the primary CTA was swapped. Mutation-proved — deleting the
restored link turns it red, restoring returns it green. **A guard written from a
misreading defends the misreading**, which is the part of this worth keeping.

Not verified locally: no `node_modules` and `npm run build` cannot complete on
this machine.

SPEC IMPACT: None — corrects an entry already recorded 2026-08-21.
