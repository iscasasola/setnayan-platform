## 2026-08-06 · feat(ci): a ported route may not lose a way out

Owner: *"we want to avoid building something that will lose parts of what should
be part of that page."*

**The fear was justified, and it was proven rather than argued.** Two real
controls were deleted from the couple's guest page — *Invite guests* and
*Arrange the room* — on a clean `origin/main`. **All twelve `lint-*.mjs` scripts,
the typechecker and Lighthouse passed byte-identically.**

That is structural, not an oversight anybody can patch:
- **There is no render harness in this repo at all.** `tsx --test` over ~620
  files; no testing-library, no jsdom, no vitest. **Not one test can observe what
  a page renders.** Every "UI" guard is a lexical scan for a named string.
- **~14% coverage** — 57 of 404 pages are named in any test, and mostly for one
  flag or one copy string, never an inventory of their controls.
- **Every existing guard is ADDITION-shaped.** Masthead, radius, legibility,
  nested-form and nav-icon all fire on a wrong thing *added*; the exposure freeze
  passes narrowings on purpose. **A port removes.**

🔥 **It has already cost us once:** the `/panood` port dropped the **YouTube API
Services disclosure** — the compliance paragraph Live Studio's Google review
depends on — and a **manual diff**, not CI, is what caught it. Those guest-page
controls were *also* orphaned once before, by an earlier reskin, and restored on
2026-07-15.

**Shipped:** one rule — *a ported route may not lose a way out.* Every route's
destinations (`href`), bound server actions (`action={}` / `formAction={}`) and
`routes.*` builder calls are compared against a baseline. **Missing → FAIL.
Added → PASS** (a port may give a page more). 404 routes, 1,190 controls.

🔑 **The baseline is GENERATED, never authored.** Nobody types a control name, so
the expected value cannot drift from the real page — it *is* the real page. Same
posture as `page-masthead-baseline.json` and `dup-rule.baseline.txt`, and the
opposite of the hand-typed comparison that let `llms.txt` drift for three weeks.

🔑 **A deliberate removal is not blocked — it is made visible.** Regenerate the
baseline in the same PR and the removed control lands in the diff as one readable
line in front of a reviewer. The guard forbids removing things *silently*.

🔑 **The query string is part of the key.** The repo's other href normaliser
strips `?query` on purpose — it asks "does a page exist here". This asks a
different question: the filter pills on Guests and Explore are `<Link>`s
rewriting the *same path* with different params, so normalising the query away
would let a whole filter row vanish with no key changing.

**Three real bugs the mutation battery found in my own guard — all of which
would have shipped a guard that protects less than it claims:**

1. 🚨 **The root route was swallowing the entire app.** The first extractor
   walked every non-route subdirectory, so `/` claimed all of
   `app/_components/**` — hundreds of shared files. Deleting a real control
   elsewhere then still "passed", because some shared component mentioned the
   same destination. **A guard that absorbs everything asserts nothing.** Now a
   route owns its own directory plus its own `_components/` and `_lib/`.
2. 🚨 **The Suite hub recorded ZERO controls** — about twenty tiles, protected by
   nothing. The `routes` builder is **nested** (`routes.dashboard.guests.index(id)`),
   my pattern matched one level, and because these appear as
   `href={routes.dashboard.budget(id)}` — an expression, not a literal — the href
   extractor could not see them either. Now the whole dotted chain is captured.
3. **`routes.ts` — a FILENAME in a comment — was being recorded as a control.**
   The builder pattern now requires a call.

**Verified by breaking it on purpose:** a fully-removed destination → caught · a
bound action removed → caught · a nested route builder removed → caught · the
original two-control deletion → caught, naming both · a destination *added* →
passes · **the extractor blinded (app root moved) → caught**, because a guard
that silently sees nothing would pass everything.

⏳ **Delete this when the port is done.** The script, its baseline and the CI job
are scoped to the port; a guard kept past its purpose becomes noise, and one that
cries wolf teaches you to skim past the time it is right.

SPEC IMPACT: None — the audit findings this implements are already recorded in
`DECISION_LOG.md` (2026-08-06).
