## 2026-08-17 · fix(doors): a third missed door, four hover-gold links, and the bill named

An adversarial audit of #4484/#4486 (57 agents, two skeptics per claim) found the
door family is larger than either PR covered.

**A third missed door — `/panood/cam/[token]`, the Live Studio camera seat.** Its
own header calls it *"A DIRECT clone of the Papic seat-claim page"* — whose
original was ported in #4484. It had the same hand-rolled wrapper, and it still
carried the *"One of the couple asked you…"* copy that its twin had already had
corrected for being wrong on 15 of the 16 event types.
🔑 **A CLONE INHERITS THE BUG ITS TWIN ALREADY FIXED**, and it survived in the
SIGNED-OUT arm for the same reason it survived in the twin: every pass through
the page was made while signed in.

**Four links that got HARDER to read on hover.** `/vendor/lock/[token]`,
`/vendor-invite/[slug]` and `/vendor/fit/[ref]` each carried
`text-ink/60 … hover:text-terracotta` — hovering moved the label from readable
ink to the 3.37:1 gold. Now `hover:text-link` (8.22:1). The `terracotta-700`
(4.86:1) and icon uses on those pages are correct and untouched.

**And the shape rule from #4486 was blind to the commonest wrapper.** It required
the width on the same tag, but four of the six wrappers `<DoorShell>` replaced
put it on an inner div:

    <main className="flex min-h-screen items-center justify-center bg-cream …">
      <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-7 …">

It now matches the PAIR. That surfaced **nine more pages** carrying the identical
card — Papic capture surfaces, the Live Studio and 3D demos, Pabati. They are not
all doors (several use the card only for a gate or error state on a camera
screen), so porting them is a design call and is deliberately NOT done here.
⚖ **They are LISTED, not silenced.** The assertion pins the set exactly: a tenth
page adopting the shape fails, and porting one of the nine also fails until its
line is deleted. The bill is visible and can only shrink.

Mutation-checked both directions: copying the card onto an unlisted page →
`fail 2`; removing a listed page's card → `fail 1`; restored → `8 pass`.

SPEC IMPACT: None.
