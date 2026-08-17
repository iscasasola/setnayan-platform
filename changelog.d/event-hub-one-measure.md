## 2026-08-17 · fix(event-hub): four measures instead of eight, and the gift page stops being the narrow one

**What a person gets.** The gift page is the same width as every other room in
the event — today it is noticeably narrower than the seat pass, the seat finder,
the table map and the recap, for no reason. And the Event Hub stops drifting
wider apart every time someone adds a page.

**Why.** Measured 2026-08-17: the guest tree used **eight** different content
widths between its rooms (`prose` 36 · `md` 20 · `3xl` 19 · `xs` 7 · `sm` 6 ·
`xl` 5 · `2xl` 3 · `5xl` 2). On a phone it is invisible — everything is narrow.
It surfaced the moment the owner asked for tablet and desktop, because **a
column that knows its measure cannot be stretched**, and that is also why the
tablet needs no new breakpoint.

**New:** `app/[slug]/_lib/measures.ts` names the sanctioned set —
**STAGE** `max-w-5xl` · **PLATE** `max-w-3xl` · **READING** `max-w-prose` ·
**PHONE** `max-w-md`.

🛑 **A CORRECTION TO THE STUDY IT PORTS.**
`prototypes/event_hub_three_widths_2026-08-17.html` § 02 says three measures
replace eight and recommends retiring the other five. **Retiring `max-w-md`
would break the bottom bar.** Measured: 17 of its 20 uses are page-level and
they are not strays — they are the PHONE COLUMN, deliberately chosen for the
surfaces that are phone-shaped by design (the bar's own tab group, the Live
hub's panels, the day-of bar, the lock screen, the not-found plate). The bar is
`fixed` at every width, so that 28rem is what keeps five tabs a thumb's reach
apart instead of stretched across a 1440px screen. **The sanctioned set is
four.**

**Changed:** the gift page's two page columns `max-w-xl` → `max-w-3xl`, joining
the plate every sibling room already uses. That was the one genuine
inconsistency.

⚠ **Deliberately NOT swept — and this is the interesting half.** The remaining
off-measure page columns are **TYPOGRAPHIC, not columns**: a standfirst, a
pull-quote, a caption, a figure, two notice plates. 🔑 **The reading measure is
`ch`-based**, so moving a large italic standfirst onto it makes its line
physically **WIDER, not narrower** — the opposite of what "tidying" implies.
That is a decision to make while looking at the page, and nobody has looked at
these since the July redesign shipped.

🛡 `measures.test.ts` — 5 assertions. The bill (`KNOWN_DRIFT`) is **exact-match
in both directions**: a NEW off-measure page column fails, and FIXING one also
fails until its line is decremented, so the list can only shrink deliberately.
Scoped to page-level columns (`mx-auto` + `max-w-*`) so an inner badge never
cries wolf. **Mutation-proved, occurrence counts printed before → after:** a new
off-measure column (1→1) **1 fail** · retiring the phone measure as the study
advised (2→1) **3 fail** · the reading measure becoming a rem width (landed 1)
**3 fail** · the gift page reverting (2→2) **2 fail** · restored **5 pass**.

⚠ **NOT OBSERVED.** This is a width change and it has not been seen on a screen
— there is no local build, and every launched production event is a wedding.
Test-proved and measured, never looked at.

⏭ **This is the measure half of the three-widths port. The other half — what the
bottom bar becomes above 1024px — is NOT in this PR.** It is a structural change
to an owner-locked shape and gets its own review.

SPEC IMPACT: None.
