## 2026-08-21 · feat(frontdoor): the front door opens with a sentence, not a filter bar

Owner, at the start of the day: *"doesn't it feel like just a youtube rip off?"*
It did, and the measured reason is stark: **the front door had no visible
headline at all.** Its `<h1>` was `.fd-sr-only` — present for screen readers and
for search, invisible to a person — so `/` opened on the chip bar and the card
grid. **A feed with nothing above it IS a feed.** YouTube can open that way
because everyone already knows what YouTube is. We cannot.

**THE OPENING.** *"The best photo of the night is on somebody else's phone."*
Then the turn: a few make it to the group chat, the group chat goes quiet, and
within a year the only album left is the photographer's — and Setnayan gathers
every photo, from every phone, into one album kept for life.

🔑 **WHY THIS ARGUMENT AND NOT A NICER ONE.** We have almost no customers, so we
cannot borrow proof — no testimonials, no counts, no ratings, and inventing them
is out of the question. What we CAN do is point at proof the reader already
owns: a group chat that went quiet and photos that never arrived. It is verified
from their own memory in about two seconds, which is the only honest proof a
company with no customers has. It is also the one claim that is **ours** —
planning tools are matchable; "every photo from every phone, kept for life" is
not.

⚠ **NO PRESSURE, AND THE GUARD ENFORCES IT.** The frame is past tense and about
other people's weddings. It never threatens the reader's own day, never counts
down, never asks "don't you want to remember it?". These are people spending the
most money they ever will. A test fails on that vocabulary.

🔑 **IT REPLACES THE INVISIBLE HEADING, NEVER JOINS IT.** New `heading` slot on
the shell: supplied ⇒ rendered as the page's one `<h1>`; absent ⇒ the sr-only
fallback survives for any front-door surface that still has none. Two `<h1>`s
would break the "exactly one each" rule closed 2026-08-13.

🔑 **AND IT ANSWERS THE APP-VERIFICATION REVIEW IN PROSE.** That review failed
because this page did not obviously say what the product is or that it is called
Setnayan. The brand name is now in the first paragraph a person actually reads —
not a meta tag.

🪤 **THE CTA NEARLY SHIPPED AS A FAKE DOOR.** I wrote `/onboarding`. **It is a
404** — there is no `page.tsx` at that path, only `[type]`, `simple` and
`wedding` beneath it, verified live. Every other create door in the app uses
`/onboarding/wedding`; this one now does too. A link that goes nowhere is the
one thing this page forbids, and I nearly put one on the homepage.
🪤 And when I grepped for the broken link I found it in the SHIPPED front door
too — until I checked: the only hit was **my own uncommitted file**. Measure the
right tree before reporting a defect.

**Colour, measured on BOTH grounds** because the white-page PR may land either
side of this one: kick/gold 5.02 (white) · 4.86 (cream) · h1 ink 14.28 / 13.82 ·
lede `--fd-m1` 5.38 / 5.21 · secondary `--fd-link` 8.50 / 8.22. `--fd-m2` was
rejected for body copy — 3.67 / 3.55, metadata grey, fails AA, and the
difference is invisible until somebody measures it.

🛡 `the-front-door-says-something.test.ts` — 5 tests, mutation-proved outside the
toolchain: pointing the CTA at the 404 turns two checks red, dropping the brand
name turns one red, restoring returns all nine green. It strips comments first,
in the file AND the stylesheet — my first cut read the lede's own comment (which
NAMES the rejected token) as evidence and reported a false failure.

🛡 **AND AN EXISTING GUARD CAUGHT THIS, CORRECTLY.**
`rail-active.test.ts` — *"the app variant does not bring the front door's hidden
`<h1>` with it"* — failed CI, because it matched the literal shape
`{ownsHeading ? null : (<h1 …` and mine now reads
`{ownsHeading ? null : (heading ?? (<h1 …`.

**The gate was never removed** — an account page still renders no sr-only `<h1>`
— so the guard's INTENT held and only its pattern had gone stale. It is
**widened, not weakened**: the optional `heading ?? (` is the only thing allowed
between the gate and the fallback, and a SECOND assertion is added that the
sr-only `<h1>` may appear exactly once, so it cannot be re-added outside the
gate while the pattern still matches inside it. Mutation-proved: deleting the
variant gate turns it red.
🔑 **A brittle guard failing an honest change is not a reason to loosen it.**
The test is stricter after this than before.

⏭ **THIS IS THE OPENING, NOT THE WHOLE CONCEPT.** The group-chat vignette, the
"one link, every phone, one album" turn, and the section for the family who
could not fly home are the rest of it and are NOT built. The reading feed still
sits below, unchanged. Named rather than implied.

Not verified locally: no `node_modules`, `npm run build` cannot complete here,
and **nobody has seen this rendered** — the owner looking is the real test.

SPEC IMPACT: `DECISION_LOG.md` row for the front-door opening.
