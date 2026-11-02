## 2026-08-04 · refactor(marketing): the doorway archetype becomes a component — two pages ported, six to follow

Second slice of `design#6`. The Editorial archetype was approved 2026-08-04; this makes it a thing the code has, instead of a shape eight pages each re-typed.

**The state it replaces.** `/pa3d` and `/pawebsite` rendered **byte-identical JSX** — every difference between them was a copy string or the route slug. Six doorways carried the same seven-section spine hand-written six times, and `/papic` carried a private fork of the motion primitives on top.

**`app/_components/marketing/_doorway.tsx`** is that spine once: JSON-LD → hero → How-it-works → the differentiator → FAQ → closing CTA. Both pages are ported; **each dropped from ~263 to 163 lines**, and what is left is entirely copy and destinations.

**Everything variable is COPY or a DESTINATION — nothing about layout, spacing, type or motion is a prop.** A "just this one page" layout prop is precisely how eight pages drift apart again, one reasonable exception at a time. Where a page genuinely needs a section the archetype does not model (`/papic`'s price anchor, `/alaala`'s pillar grid) it passes `children`, so an exception is **visible as an exception** rather than smuggled in as a prop nobody else uses.

### The h1 is no longer a decision anyone can get wrong

`LineRevealHeading` defaults to `as = 'h2'`. Every doorway used to get its only h1 from a prop at its own call site — seven separate chances to forget, on pages whose entire job is to be found, with nothing in the repo checking. `as="h1"` is now written **once**, inside the kit, and `DoorwayProps` deliberately exposes no `as` prop — a caller who could pass one could pass `'h2'`.

### The guard fired on the port, and following it was the point

`doorway-invariants.test.ts` (shipped hours earlier, #4090) went red the moment the pages were ported — the h1 and the `ld+json` tag had moved out of each route's folder and into the kit. **The invariant was still true; the guard had lost sight of it.** It would have been easy to loosen the assertion. Instead the check moved to where the h1 now lives, and got stronger doing it: it now also pins that the kit renders **exactly one** h1, that `DoorwayProps` exposes no `as` override, that the kit renders **every** structured-data block rather than the first, and that a route mounts the kit exactly once.

**Mutation-verified at the new location:** turning the kit's `as="h1"` into `as="h2"` fails; rendering only `structuredData[0]` fails with *"must render EVERY block it is given, not the first"*. Restored, green.

**Six doorways remain** (`/papic` with its private motion fork, `/panood` with its deliberate YouTube disclosure, `/palogo` whose secondary CTA points at `/monogram`, `/alaala` the umbrella page, `/patiktok`, `/setnayan-ai` which already solved this shape independently). They follow one at a time, against the same guard. `/` stays excluded and `/features` remains its own job.

Verified: 6448/6448 unit tests, `tsc --noEmit` clean, lint clean. No behaviour change, no visual change — the rendered markup is identical.

SPEC IMPACT: None.
