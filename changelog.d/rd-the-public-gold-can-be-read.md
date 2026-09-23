## 2026-09-23 · fix(a11y): the public pages' gold button can be read too

**SPEC IMPACT: None.** No locked decision moves. The brand ladder is unchanged —
this uses rungs that already exist.

### What was wrong

`.m-btn-orange` is the call-to-action on `/vendors` and `/creators` — "Open your
shop", "Talk to us". White label on `--m-orange` `#A9834B` measures **3.48:1**,
against the 4.5:1 AA floor for normal text.

This is the **second half** of the dashboard fix in `rd/the-gold-can-be-read`
(#5915), which this branch is stacked on. That one moved
`.app-surface .button-primary` and `.sn-btn-primary`; it could not reach this
rule, and baselined it instead.

### 🔑 Two ladders, one colour — and that is the finding

`--m-orange` and `--sn-gold-500` are **separate variables that both hold
`#A9834B`**. So are `--m-orange-2`/`--sn-gold-700` (`#8A6B39`) and
`--m-orange-deep`/`--sn-gold-800` (`#5C4726`). Nothing links them: either can be
re-toned without the other moving, and then two pages wearing "the same gold"
quietly stop matching. Each ladder needed its own fix — this is not a duplicate
of #5915, it is the other one.

### The change

| | was | now |
|---|---|---|
| `.m-btn-orange` | `--m-orange` `#A9834B` · 3.48:1 | `--m-orange-2` `#8A6B39` · **4.95:1** |
| `.m-btn-orange:hover` | `--m-orange-2` `#8A6B39` · 4.95:1 | `--m-orange-deep` `#5C4726` · **8.81:1** |

**The fill moved, not the token.** `--m-orange` is also a focus ring, a border
and a background blob across the marketing pages; darkening the token would
repaint all of them to fix one button.

**The hover moved too.** Its old value already cleared the floor, so leaving it
would have made *hovering* the only readable state — the shape that hid the
dashboard button for months.

### Two repairs to the guard that found it

The CSS-rule scan added in #5915 had grown **its own comment stripper**, which
`lint-one-comment-stripper` blocks and which was failing that PR's CI. It now
uses the repo's one stripper (`stripComments` from `scripts/port-controls.mjs`).

That also fixed a wrong answer: the private version *deleted* comments, shifting
every offset after them, so the failure was announced at `globals.css:399` for a
rule living at `:1370`. `stripComments` blanks in place. A second offset was
needed on top — the block regex's selector group starts after the **previous**
rule's `}`, so it was still reporting the top of the preceding comment. Now
exact.

### ⚠ The scan has a blind spot — and the first version of this note blamed the wrong thing

A rule whose `background` carries `url(...)` is **dropped before its colours are
ever compared**, because the shorthand stops resolving to a single colour. Its
label/fill pair is never measured.

This branch first recorded that hazard as *"the JS comment stripper eats an
unquoted `url(https://…)`"*. **That was wrong**, and it was wrong in the
direction that would mislead: it told the next reader the risk was text-eating
and that quoting their URLs would save them. Neither is true. Isolated with a
four-case fixture:

| fixture | convicted? |
|---|---|
| `color` + `background-color`, no url | ✅ yes — the fixture is valid |
| + **unquoted** `url(https://…)` | ❌ no |
| + **quoted** `url("https://…")` | ❌ no ← kills the stripper theory |
| + plain `background:#ffffff` | ✅ yes |

A quoted URL is skipped too, and no comment stripper touches a quoted string. So
a language-correct CSS stripper would **not** have closed this hole, which also
means the shared `stripComments` was not a compromise here — for this blind spot
the two are identical.

Today **no** rule in the tree both carries a `url()` and sets a colour pair, so
nothing is being missed; it fails silently the day one does. The re-measure
command is recorded in the guard's own docblock, and it was **proved able to
fire** — 0 on the tree, 1 with a seeded rule — so the zero is a measurement and
not a silence. Closing the hole properly means parsing the colour out of the
shorthand, which is a change to the guard's own design and belongs with whoever
owns it, not smuggled into a contrast fix.

### The pill, ruled on separately

`.m-pill-orange` was left alone in the first cut of this branch — different
pairing, different component, and the ruling had been about buttons. The owner
was asked and said yes, so it is fixed here: label `--m-orange-2` →
`--m-orange-deep` on the same `--m-orange-4` wash, **4.21:1 → 7.50:1**. 12px
text, so no large-text exemption applies. No `:hover` rule exists, so there is
no second state to clear.

**🔑 Here the LABEL moves, not the fill — the opposite of the button, and on
purpose.** The guard's own advice ("fix the FILL, not the label") is written for
white-on-gold, where swapping white for cream buys about 0.1. This is the
mirror case: dark text on a pale wash, where the wash *is* the component's
identity and the text is what can move. Not a new pairing either —
`--m-orange-deep` on `--m-orange-4` already ships in `vendor-grow-sections`,
`admin/data-privacy` and `npc-checklist`.

### 🛑 …and nothing renders it

`.m-pill-orange` and its base `.m-pill` have **zero usages in the tree** — three
matches for the name repo-wide, and they are the CSS definition, the baseline
entry and this changelog. No dynamic class construction either. So this fix is
correct and invisible: it repairs a component no page mounts.

Fixed rather than deleted because that is what was asked, and because a fixed
rule costs nothing. **Deleting the pill is the better answer and it is an owner
call, not a build one** — flagged, not taken.

### What is still baselined after these two removals — 50 → 48

Both removals are proven by the stale-entry check rather than asserted. What
remains is not a list of things anyone gave up on; it is the list nobody has
ruled on yet:

| file | entries |
|---|---|
| `app/admin/ugat/_components/ugat-console.css` | 18 |
| `app/onboarding/wedding/_styles/onboarding.css` | 14 |
| `app/_components/home/home-reskin.css` | 7 |
| `app/globals.css` | 4 |
| `app/_components/frontdoor/front-door.css` | 2 |
| three others | 1 each |

The admin console is internal-facing and the largest block by far; the
onboarding and home files are not. **The list may only shrink** — the guard
enforces that in both directions.
