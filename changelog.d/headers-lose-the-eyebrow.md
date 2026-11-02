## 2026-08-18 · design(app): the page header loses its eyebrow and its paragraph

**SPEC IMPACT:** None — this changes how existing pages present copy they already
had; no price, SKU, schema or product decision moves.

Owner, on three screenshots of the eyebrow + title + paragraph stack: *"we do not
need these. it just eats up space and we want it to be simpler to understand on
each page without too much side comments. if you need description for what that
part does you can add the (i)"* — then, on how it should feel: *"look at how apple
makes everything simple."*

**97 page headers** across the couple dashboard, the vendor dashboard and the
admin console now render one row — back chevron · title · (i) · actions — through
the shared `<PageMasthead>`. `app/_components/page-masthead.tsx` gained the (i): a
native `<details>`, so it costs zero client JavaScript and works in the server
components these pages all are. `lede` is unchanged as a prop, so the 36 surfaces
that already used the masthead moved with the rest.

**Nothing was redrawn.** `<PageMasthead>` and its lint have existed since
2026-07-21 and already encoded the no-eyebrow rule; the gap was that only 36 of
133 pages had adopted it. `scripts/page-masthead-baseline.json` goes **109 → 15**.

The 15 that remain are **section** headers — an `.sn-eye` labelling a group of
content inside a page, the shape Apple's own Settings screens keep ("Daily
Usage"). They are not the thing the owner pointed at, and 11 of the 15 sit on a
page whose real header is now a masthead.

**Back chips fold into the chevron.** A "Back to X" link was its own row above its
own header — two blocks saying where you are. Seven routes whose ONLY `<Link>` was
that chip show up in `lint-port-no-lost-controls`; its baseline is regenerated
here, and the regeneration was **measured before it was trusted**: 402 routes
before and after, **zero** destinations lost, **zero** actions lost, and exactly 7
block substitutions — `Link` → `PageMasthead`, which renders the same `Link`.

**Guards.** `app/_components/page-masthead.test.ts` — 5 assertions, all six
sabotages measured by occurrence count as having landed and each confirmed RED
before the test was trusted. It pins: no eyebrow prop or `.sn-eye`; the lede
renders only inside the (i); the (i) is 28px (over the 24px WCAG 2.2 floor) and
carries a real accessible name; it never uses `text-terracotta`, which in this
repo is the **gold** slot at 3.37:1 on cream; and the h1 keeps its responsive
step, because below `lg` it is the only wayfinding on screen.

Three defects were found by reading the output rather than trusting it, and each
is written into the code that caused it: a re-indent helper that sliced the first
line of a block and turned `{saved ? (` into `(` — a deleted conditional that
reads fine and is a syntax error; an `actions` remainder that was already a JSX
expression getting wrapped again into an object literal; and import pruning that
compared whole specifiers, so `type LucideIcon` and `Image as ImageIcon` were
deleted while still in use.
