## 2026-08-08 · feat(guards): the port guard now watches WIDGETS, not just ways out

The owner, on being told the design port was underway: *"should we have a
prototype first? make sure all widgets are there?"*

The right answer was that a stronger mechanism already existed — every
destination and every bound server action on all 400 routes, re-checked on every
change. But checking it properly exposed that it only answered **half** the
question.

🔑 **A MISSING BUTTON IS LOUD. A MISSING PANEL IS SILENT.** Controls are what a
person can *do*; losing one means somebody cannot get somewhere, and they say so.
Nothing watched whether a redesigned page still **shows** the same things. That
failure has no symptom: the page looks finished and simply tells you less. It has
already happened here — the `/panood` port dropped the YouTube API Services
disclosure, a compliance paragraph with no link and no action in it, so a
controls-only guard could never have seen it. A manual diff caught it.

### What is now recorded

**3,511 blocks across 400 routes** — every capitalised JSX element each route
renders, alongside its 1,186 controls. Missing → the build fails.

🔑 **A BLOCK IS THE UNIT THE OWNER MEANS BY "WIDGET".** Not a sentence, not a
number — a rendered component. And it is the one identity a restyle does *not*
disturb: the whole point of the port is that a panel keeps its name while every
pixel inside it changes.

**Icons are excluded by IMPORT SOURCE, not by a name list.** Icons are
capitalised JSX elements too, and swapping one is exactly what a restyle is
supposed to do — left in, this would fire on nearly every port unit, and a guard
that cries wolf teaches you to skim past the one time it is right. Filtering per
file by where the symbol was imported from also handles `Calendar` being a lucide
icon in one file and a real panel in another; a global name list would be wrong
in both directions.

Deliberately **not** recorded: prose, numbers, data paths. A port rewrites copy
by design, and the specs retire real numbers on purpose. The block is the largest
unit that is still honest.

### 🪤 Comments were counted as rendered widgets — found by sabotage

Deleting `<EventDashboard …>` from the couple's dashboard — **the entire body of
the page** — passed. The name still appeared in four docblocks around the route
(`loading.tsx` says its shape "mirrors the `<EventDashboard>` render order"), so
the set never changed.

**The richer a file's comments, the less its widgets were protected** — exactly
backwards, and worst on the heavily-documented surfaces this repo cares most
about. Comments now go through a string-aware stripper before any pattern runs,
which removed **47 phantom blocks, 2 phantom destinations and 1 phantom action**
from the baseline.

The file already knew a milder form of this: the `routes` pattern carries a note
that the string `routes.ts` **in a comment** was once recorded as a control, fixed
by demanding a trailing `(`. That fix was per-pattern; this one is at the source,
so every extractor inherits it.

⚠ The stripper **must be string-aware** — a naive `//` strip eats the rest of the
line from inside `href="https://…"`, silently truncating real source. Hence a
small lexer rather than a regex.

### 🪤 Then the SABOTAGE HARNESS was wrong twice, and both looked like guard holes

1. **`.replace()` with a string pattern replaces only the FIRST match** in
   JavaScript — my harness comment claimed "ALL occurrences". For
   `<EventDashboard` the first match is a docblock on line 57; the real render on
   line 528 was never touched. The guard passed **because nothing had been
   removed**, and I nearly filed that as a hole in the guard.
2. The "did the sabotage hit real code?" check compared **stripped text**.
   Blanking a comment preserves length per character, so a *shorter* replacement
   inside a comment changes the text without changing any extracted set — a
   comment-only edit scored as a valid sabotage.

Both now fixed: `replaceAll`, and the precondition is that the **extractor's own
set** loses something. Invalid sabotages are refused loudly instead of scored.

🔑 **"Verify the sabotage landed" is not enough — verify it landed WHERE IT
COUNTS.** A sabotage that provably edited the file and provably changed nothing
the guard reads is worse than no sabotage: it manufactures a false hole and sends
you hunting.

### 🛡 Proven

| sabotage | result |
|---|---|
| couple's dashboard loses its whole body | ✓ caught |
| vendor Overview loses its needs-you-today feed | ✓ caught |
| My Shop loses the get-verified section | ✓ caught |
| adding an attribute everywhere (a restyle) | passes, correctly |
| a prose-only edit | refused as meaningless, not scored |

Non-vacuity extended to the new dimension (`< 1000` blocks fails outright), and
the generator refuses to write a baseline without them — so this cannot quietly
stop extracting and pass everything.

An **older baseline with no `blocks` key degrades to controls-only** rather than
reporting every block on every route as lost. Verified against the pre-change
baseline before regenerating.

**No CI wiring needed** — this extends a guard already armed in all three
required places.

### Verification

- **7,092 unit tests pass**, 0 fail · **all 21 lint guards green** · `tsc` clean

SPEC IMPACT: None — answers the owner's 2026-08-08 question with a mechanism
rather than a prototype.
