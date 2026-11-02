## 2026-08-04 · test(marketing): pin the three things a public doorway must never lose, BEFORE the port touches them

First slice of `design#6` (public doorway pattern), and deliberately not a design change. The archetypes were approved 2026-08-04 and the port collapses eight near-identical doorway pages into a shared section kit — `/pa3d` and `/pawebsite` render **byte-identical JSX**, differing only in copy strings. That collapse is the right move and the dangerous one, because three invariants are currently held by **hand-typed values at each call site**, and all three fail silently:

1. **The h1.** `LineRevealHeading` defaults to `as = 'h2'`. Seven of the eight routes get their ONLY h1 from a prop at the call site. Move the hero into a kit, forget the prop in one variant, and the page ships with **no h1 at all** — and nothing in this repo says a word: not the masthead lint, not Lighthouse (which does not audit these routes and has no h1 audit in any category), not any test.
2. **The canonical.** Every route hand-types its own. Porting two byte-identical pages together is the precise condition under which a copy-pasted `canonical: '/pa3d'` lands on `/pawebsite`. Both render perfectly; one silently leaves the search index.
3. **The structured data.** Each doorway ships SoftwareApplication + FAQPage JSON-LD. Dropping it costs rich results on a page whose entire job is to be found, and the loss is invisible on screen.

**Mutation-verified against both real failure modes:** copying `/pa3d`'s canonical onto `/pawebsite` fails and names it; turning one `as="h1"` into `as="h2"` fails with `/pa3d: 0`. Restored, green.

⚠ **The first draft of the counter was wrong, and the way it was wrong is worth keeping.** It accused `/papic` of having two h1s. It has one — a `<h1>` inside `_papic-motion.tsx` (the polymorphic heading component's *implementation*) plus one `as="h1"` at the call site (the actual decision). A file that declares a polymorphic `as` prop is a heading component and its literal `<h1>` is machinery. `/setnayan-ai` is the counter-example proving the rule: its hero renders a fixed `<h1>` and takes no `as`, so that one IS the decision.

**Scope note — what this slice deliberately does NOT do.** Adversarial review found the contract's `design#6` premise **falsified for the third time on this programme**: *"the genuine gap is CUSTOMER-side: Free → Setnayan AI is not framed as a delta"* is **false** — `app/pricing/page.tsx:667` already ships the literal string `'Everything in Free'`. Review also split `design#6` into three jobs wearing one id (the doorway port · `/features` · the delta framing), found both delta-framing files sit **outside design#6's own declared touches glob**, and flagged the nav/footer reachability work as belonging to an open owner programme on the excluded homepage. None of that is done here.

`/` stays excluded (ELN cinematic reskin, owner-approved 2026-06-29) and `/features` stays out (a different design language with a bilingual `/tl` twin) — both asserted rather than remembered, so widening the work requires editing an assertion.

Verified: 6445/6445 unit tests, `tsc --noEmit` clean, lint clean. No source file changed — this is a test and a changelog.

SPEC IMPACT: None. The falsified premise and the three-way split are recorded in `DECISION_LOG.md`.
