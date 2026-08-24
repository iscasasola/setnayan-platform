## 2026-08-24 · fix(vendors): the couple's supplier screens stop writing in below-AA gold, and the search overlay's serif finally resolves

W4-A screen 2 of 4. Twenty-nine text sites across the couple's vendors tree —
kickers, links, hover states, the saved-plans column headers, the review
page's seven back-links — wore bare `text-terracotta` (#A9834B, 3.37:1 on the
white ground, below the 4.5:1 AA text floor). All move to `terracotta-700`
(#8C6932, 5.02:1). One was worse than low-contrast: quote-fill's inline
ERROR message was gold — a refusal dressed as an accent — and now wears
`danger-700` like every other error in the tree. Icons and checkbox accents
keep the bare gold (3:1 non-text bar).

Separately: the category-search overlay declared
`--serif: var(--font-serif, 'Cormorant Garamond', serif)`. The raw
`--font-serif` CSS variable is defined nowhere (the Tailwind `font-serif`
utility is a different mechanism), and next/font hashes its family names so
no `@font-face` is named 'Cormorant Garamond' either — every serif title,
vendor name and empty-state in that overlay has computed the PHONE'S DEFAULT
SERIF since it shipped. It now points at `--font-editorial-display`, the
variable Cormorant actually ships under on `<html>`. Rejected-not-thrown, CSS
edition: the browser honoured the declaration and quietly rendered something
else.

The `gold-is-not-text` bill shrinks by 29 in the same commit — the guard is
checked in both directions, so landing the fixes without shrinking the bill
is itself a red test.

SPEC IMPACT: None.
