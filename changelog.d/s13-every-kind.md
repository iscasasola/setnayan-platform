## 2026-09-09 · feat(story): the story holds for all sixteen event kinds — and a wake gets one

S13 of the by-the-minute build (`08` steps 3.1–3.3). Owner ruling 2026-08-15:
"each event they create will have an editorial not just wedding."

**3.1 · The masthead names one person when the event has one.**
`splitCoupleNames` chose the WEDDING treatment — two stacked lines with an
italic gild joiner — by sniffing the display name for " & " or " and ".
Measured against real non-wedding names before the fix:

    "Ayala & Partners Year-End"  →  "Ayala"  &  "Partners Year-End"
    "Bench & Co Summer Outing"   →  "Bench"  &  "Co Summer Outing"

A corporate year-end party was rendered as a couple. The separator is a fact
about punctuation; whether an event has two people at its centre is a fact
about the EVENT TYPE. `EventWords.twoPeople` now carries that fact, read from
`terminology.person_b` — populated on the wedding row and NULL on every other
seeded type, measured across all eight seed/backfill migrations. Defaults to
today's split so an un-wired caller cannot flatten a real couple.

**3.2 · The solemn arm — a wake now GETS a story.** Owner ruling 2026-09-09,
build arm (b): "no Relive, no challenges, no anniversary, no countdown, and the
family's words."

`solemnAdjustedPhase` demoted BOTH `save_the_date` and `editorial` to `rsvp`,
so a wake got no story at all. That was one gate doing two jobs. It now demotes
`save_the_date` only, and the two are separated at the seam that actually
divides them — AUTHORSHIP, not lifecycle.

⚠ **The refusal of the joyful auto-composed recap is untouched, and that is
measured rather than asserted.** `composeCopy`'s joyful output is not rendered
on the story page at all: S9's spine "replaced the masthead and the lead", and
the one field the story still takes from the composer is `pullQuote` — the
host's own `special_message`. The article body reads `data.draft.leadParagraphs`
falling back to the host's own prose. Every sentence a wake's story can print
was typed by the family, so granting the phase resurrects nothing.

Inside the story: Relive is refused on the REGISTER (not on `slides.length` — a
wake HAS minutes, so an emptiness gate would be green on the empty story and
wrong on the real one), and all three challenge-answer reads route through one
`challengeAnswersFor(data, words)` helper. The countdown and the anniversary
mail selector already refused the solemn register and are unchanged.

**3.3 · Zero suppliers.** Already shipped inside S11's one emptiness rule — the
host-layer tabs omit themselves at zero in `buildStoryIndex`, which takes the
team tab, the #1-match tile (an entry note) and the tier legend (the tab's note)
together. No second rule was written beside it; the behaviour is now PINNED,
with the paired booked-event case so the check cannot pass by absence.

**Guards.** Every new guard was mutation-tested rather than assumed: deleting
the Relive gate, swapping it for the plausible-but-wrong `slides.length` gate,
adding a fourth direct `data.challengeAnswers` read, removing the helper's arm,
un-wiring one masthead mount, ignoring the flag inside `splitCoupleNames`, and
keying `twoPeople` off `person_a` each take the suite from green to one
failure. The challenge scan is a WALK of the file, so a new read fails closed.

SPEC IMPACT: `Design_Editorial_By_The_Minute_2026-09-07/05_Occasions_Registers_MultiDay.md`
§2 — the open question "does by-the-minute REFUSE the solemn register outright,
or ship this quiet arm?" is CLOSED by the owner's 2026-09-09 ruling in favour of
the quiet arm. `08_Build_Order.md` steps 3.1–3.3 marked built.
