## 2026-08-17 · fix(event-hub): the bottom bar stands up on a desktop instead of striping the screen

**What a person gets.** On a laptop or a big monitor, the event page's five
buttons stand up as a small column at the left instead of a strip pinned across
the whole bottom of the glass. Same five, same order, same names.

**Why.** The bar was `fixed` at **every** width and carried **no responsive
modifier at all** — measured, not assumed. On a 1440px screen it striped the
full width with the five tabs clustered in a centred 28rem group and a metre of
empty rule either side. Shipped behaviour, not a hypothetical: the guest tree
used `sm:` 124 times, `lg:` 23 and `md:` **zero**, and none of them reached this
component.

🔒 **Five slots stays five.** A wider screen is not a reason to reopen an owner
ruling — a tab that appears only when there happens to be room teaches people
the bar is unreliable. The rail maps the resolved `slots` verbatim; it cannot
add, drop or reorder one, and a guard asserts it does no filtering of its own.

🔑 **The camera is NOT re-centred on the rail.** Centring it is a THUMB decision
— the easiest reach on a phone held one-handed. A vertical rail read by a mouse
has no such centre, so the camera keeps its ACTION COLOUR (what marks it as the
destination) and drops the centring (what was only ergonomics). Copying the
middle position across would be mimicking the shape instead of the reason.

🚨 **THE BREAKPOINT IS ARITHMETIC, AND MY FIRST CUT WAS WRONG.** The rail floats
in the left margin, which is `(viewport − widest column) ÷ 2`. I first put an
**11rem rail at `lg`** — which fits beside the 48rem plate that MOST rooms use,
and would have sat **on top of** `/venue` and the editorial, which use the 64rem
stage. **The constraint is the WIDEST column, not the common one**, and the
common one is what you picture. Now a 7rem rail at `xl`: 1280px − 64rem = 8rem
of margin, 7rem + 0.75rem gutter clears it.

🛡 `rail-fits.test.ts` — 6 assertions, all reading numbers **out of the
component** rather than re-typing them. It asserts the fit arithmetic, that `lg`
would NOT have fitted (so the reason survives), that the bar and its height
reservation vanish at exactly the rail's breakpoint (otherwise a dead 3.5rem
strip sits at the foot of every desktop page), that the rail cannot invent a
sixth slot, that the camera keeps the action colour and gold never becomes text,
and that a locked slot still says why.

🪤 **AND THE GUARD WAS DECORATIVE ON ITS FIRST RUN — caught by mutation, not by
reading.** Its width regex scanned the whole file and matched `w-[1.375rem]`,
**the camera glyph**, hundreds of lines away — so the fit check compared an
icon's size against the margin and could never fail. Widening the rail 7rem →
9rem stayed **GREEN**. Extraction is now scoped to the rail's own `<nav>`.
**Scope the extraction to the element you are asserting about.**

**Mutation-proved after the fix, occurrence counts printed before → after:**
rail dropped to `lg` (1→1) **2 fail** · rail widened to 9rem (1→1) **1 fail** ·
widened only to 7.5rem, i.e. 8.25rem against an 8rem margin (landed) **1 fail** ·
gutter widened `pl-3`→`pl-8` (landed) **1 fail** · bar hiding at a different
breakpoint than the rail appears (3→1) **1 fail** · camera losing the action
colour (2→1) **1 fail** · rail filtering slots (landed) **1 fail** · restored
**6 pass**.

**Both forms are always in the markup**, one `display:none` at any width — which
removes it from the accessibility tree too, so a screen reader meets exactly one
navigation, never two identically-labelled ones. A CSS switch on purpose: a JS
viewport measurement would flash the wrong form on first paint.

⚠ **NOT OBSERVED.** There is no local build and every launched production event
is a wedding, so this is arithmetic and tests, never a screen anyone looked at.
**The width where it matters most — a real desktop — is exactly where nobody has
seen it.** Worth one look after deploy.

⏭ Not in this PR: the contents index that the study puts beneath the rail. That
is the navigation build, and it does not exist yet.

SPEC IMPACT: None.
