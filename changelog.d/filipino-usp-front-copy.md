## 2026-08-06 · feat(home): the owner-approved Filipino front-page copy finally enters the code

The owner approved a **full repositioning of the front page on 2026-07-31**
(`03_Strategy/Claude_Design_Brief_2026-07-31.md` § 5), answering both scope
questions in the same turn: the whole front moves, and the top of the funnel
stays **non-sectarian** — binyag · kumpil · kasal · aqiqah belong on the deeper
pages only. The words were drafted and then **never entered the code**. For five
days `/` kept shipping the culturally neutral line they replaced:

> ❌ "The independent hub to keep a lifetime of memories, and plan any event, free."

Three § 5 strings are now live, verbatim:

- **Hero sub-line** → "The Filipino way to keep a celebration — remembered by
  everyone who came, not just the couple. Plan any event, free."
- **Manifesto** → the samahan paragraph: a Filipino celebration was never one
  family's, so the memory shouldn't belong to one camera either, and everyone
  goes home with their own. Bold anchors are now `hold` · `attend` · **samahan**;
  the serif-italic finale "keep it, for life." is unchanged.
- **Ala ala dock copy** → "Not one family's album. The whole samahan's — …".
  This is § 5's "Pillar 01 — Ala ala · Memory Hub" block: it shares 24
  consecutive words with the dock tile's existing `desc` and nothing with the
  below-fold `PILLARS[0].def`, and § 5 writes the name lowercase ("Ala ala")
  exactly as the dock tile does. The below-fold pillar section is untouched.

**Nothing else was reworded.** § 5 gives copy for these three surfaces only, so
pillars 02–05, the ticker, the stories, the page metadata and the JSON-LD were
left exactly as they were rather than invented.

### The one thing that is not copy: two numbers that size type to the words

The approved manifesto is **96 words where the old one was 55**, and the section
is a one-screen beat (`min-height:100dvh`) inside a `scroll-snap-type: y
mandatory` scroller — so a paragraph taller than the viewport pushes its own
closing line past the first snap stop. Measured in a browser at the old scale it
did exactly that: **799px against a 720px laptop viewport, 792px against a
375×667 phone.**

- `.hr-manifesto p` font-size `clamp(1.6rem, 3.6vw, 2.7rem)` → `clamp(1.3rem,
  3.05vw, 2.3rem)`. Re-measured at 360×640, 375×667, 768×700, 1024×600,
  1280×720, 1920×1080 — the section now fits at every one, with no horizontal
  scroll and the dock still clear of the fold.
- word-cascade `transition-delay` `22ms` → `13ms` per word. The gold underline
  sweep on `.hr-mfin` fires at a **fixed** 1.35s; at 22ms the 96th word was still
  inking at 2.1s, so the sweep would have landed mid-cascade instead of closing
  it. 96 × 13ms = 1.25s restores the designed order.

No colour, spacing, structure or component changed. The terracotta palette is
untouched.

⚠ **Measured and accepted, not fixed:** on the *smallest* phone (375×667) with
the Ala ala tile selected, the gap between the "Learn more →" label and the top
of the dock tiles narrows from 18px to **8px**. Nothing clips, nothing overlaps
visually, the dock stays on screen. Closing it further would have meant shrinking
the hero sub below 14px or re-spacing the gate — a redesign, not a copy change.

### Guard

`apps/web/lib/home-front-copy.test.ts` (7 assertions) pins the hero sub, the
headline lines, the brand kicker, the manifesto, the samahan clause and the Ala
ala copy; asserts the retired neutral sentence is gone from all three homepage
files; and asserts no faith-specific rite has crept into any of the three § 5
strings. **Watched fail against `origin/main` first — 5 of 7 red**, including one
that names the retired sentence in its message.

This is a **pin, not a drift guard**, and its docblock says so: the right-hand
side is not a second copy of the source, it is the owner's approval transcribed
from § 5. Editing the page alone fails; editing both is a deliberate act.

SPEC IMPACT: None — this lands copy the corpus already carries as approved
(`03_Strategy/Claude_Design_Brief_2026-07-31.md` § 5). No decision changed. ⚠ For
the record, that brief's § 1 palette is **superseded** by the terracotta lock of
2026-08-01 and was deliberately not used here; only § 5 copy was taken from it.
