## 2026-09-08 · feat(setnayan-ai): the buy page shows the product instead of describing it

The in-app Setnayan AI page — `/dashboard/[eventId]/studio/setnayan-ai`, the one
that asks a couple for money — rendered nine near-identical bordered rectangles,
~300 words of prose, and not one picture of the product. Owner, looking at it:
*"this is just a bunch of rectangles with information. it feel too wordy … we
want to push a more image simple impact on the description"*, pointing at the
same rival features page that produced `_spotlights.tsx` on 2026-08-29 and
reshaped the eight public doorways on 2026-09-05. The public `/setnayan-ai` page
had already been rebuilt that way. This one had not.

**Rule 0 — the renderer already existed and is not written again.**
`SetnayanAiValue` now composes the shipped `Spotlights` kit and supplies only
content. The pictures are stills of THIS product's own demo scenes
(`studio-card-demo.tsx`, captured by `scripts/capture-demo-stills.mjs`) — they
have existed since the App Store card shipped and had never appeared on the buy
page.

**Nine paragraphs went away. Nine promises did not.** Each capability id is
claimed by exactly one spotlight through a `caps` field, and the copy test fails
if an id is missed or double-claimed — so this page cannot get shorter by quietly
promising less. `CAP_ICON`'s drift guard is REPLACED, not deleted: there are no
longer nine cards to put icons on, so the guard now pins the thing that does the
showing.

🖼 **A picture is a claim, and no copy test can read one.**
`stills/setnayan-ai-2.jpg` prints the words *"3 couples inquired for your date"*
INSIDE the image — true for a wedding, false for a birthday: the exact wedding-ism
`setnayan-ai-value-copy.ts` exists to kill, except baked into a JPEG where the
copy sweep is blind to it. The picture is now chosen the way the words are —
derived from `organizerNoun`, never named by type — and a non-couple event type
gets a photograph instead. Pinned by name in the test, because that is the only
thing that catches it.

🔒 **`spotlights-are-real.test.ts` scanned `app/(shell)` only.** Every in-app
surface composing the kit was invisible to it, so a still that was never captured
would have 404'd on the buy page with nothing to catch it — at the worst possible
moment, in front of the fewest people who would report it. The scan now takes
explicit extra sources and fails loudly if one is renamed out of the list.

Verified by sabotage, not by passing: dropping a capability, showing the
couples-only still to a birthday, and naming a still that does not exist each
fail the guard written for them.

SPEC IMPACT: None. No capability, price, promise or locked decision changed —
all nine claims are still on the page, in the same words or shorter. This is the
presentation of an existing surface, brought into line with the spotlight
archetype already applied to the public doorways.
