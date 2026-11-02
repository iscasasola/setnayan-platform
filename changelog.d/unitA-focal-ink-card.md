## 2026-08-08 · design(#4): the focal headline goes cream

**Narrowed from what this branch originally did — deliberately, and this is the
interesting part.**

It was written to turn the couple's Big-Day focal from obsidian glass into a
solid ink card, styled **inline on this one page**. Its stated reason:

> `.sn-tile-dark` has 20+ consumers across the app; restyling the shared class
> here would repaint surfaces this port has not reviewed.

**That was measured and it was wrong.** `.sn-tile-dark` has **seven** consumers,
and every one of them is the focal card of its own surface — admin home, this
dashboard, the day-of card, vendor on-the-day (×2), vendor overview, vendor
performance. Seven surfaces wanting one treatment is a class, not seven copies of
the same hexes. The app-wide skin swap did exactly that, so the surface work here
is already done and this branch's version of it would have been a **second source
of truth for the same values**.

Inlining also silently dropped two things the class provides: the `--m-*` token
remap that lets a card nested in the dark sidebar follow the sidebar instead of
punching a cream hole in it, and the hover lift.

🔑 **A SCOPE GUARD IS A CLAIM ABOUT A NUMBER, SO CHECK THE NUMBER.** "20+
consumers" was never counted; it was an estimate that justified the more
expensive option, and it survived into a merged-ready PR. The cheap version of
this check is one `grep -c`.

### What actually ships here

The focal's headline and sub-line move from `#F3ECDF` (gold-100, a warm
parchment) to cream `#FDFBF7` — the palette lock's own value, and what § 2.4 of
the spec asks for. **Two lines.** Per-surface headline colours were explicitly
left to the per-surface units when the skin swap landed; this is that.

### 🪤 Why this sat open and failing

The branch was pushed with auto-merge **armed** and its checks **red**, so it
looked handled and merged nothing. It went stale behind main; rebased onto
current main it passes untouched. **Armed is not the same as will-merge** — a PR
can sit indefinitely in that state looking done from the outside, which is how
this and the "Meanwhile" card both came to be recorded as shipped when neither
was in `main`.

### Verification

7,092 unit tests pass · 21 lint guards green · `tsc` clean.

SPEC IMPACT: None — completes § 2.4's headline colour; the surface half shipped
with the skin swap.
