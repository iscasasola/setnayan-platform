# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-07 · fix(vendor): the service-card sheet escapes the page transform

Owner, trying to create a service card: *"i also cannot make a service card it stay on the upper
right. cannot read and edit."*

### Measured, in production, in the owner's own session

Viewport 1187×1208. The canvas maker's sheet backdrop is `fixed inset-0`, so it should fill the
viewport. It measured **top 77px, height 184px**.

The cause is one line of computed style on an ancestor:

```
.sn-page-enter   transform: matrix(1, 0, 0, 1, 0, 0)
```

An **identity** transform — left behind by the page-entrance animation, changing nothing visible.
But any non-`none` transform makes an element the containing block for `position: fixed`
descendants. So the backdrop was sized against a 184px fragment instead of the viewport, and
`lg:my-auto` then faithfully centred a 435px sheet inside it:

```
margin-top: -125.5px   ( = (184 − 435) / 2 )
→ sheet top: −48px, above its own container, over the header
```

🔑 **NOTHING WAS MIS-STYLED.** Every rule did exactly what it says. The container was the wrong
size, and the only visible symptom was a panel crushed into a corner — which reads as a layout
mistake and is not one.

### The fix — the one this repo has already made twice

Portal the sheet to `<body>`, with the standard mount guard. `category-search-overlay.tsx` and
`team-summary-chip.tsx` both already do this, each with its own note explaining the same trap; the
canvas sheet was the one that missed it.

**Deliberately NOT done:** removing the identity transform from `.sn-page-enter`. It would also fix
this, and it is a shared page wrapper — anything else relying on it as a containing block would move
with it. Not a change to make while chasing one sheet.

**Also deliberately NOT done:** touching `lg:right-0` / `lg:my-auto`. The right-dock design was
correct all along; a "fix" that deleted it would have hidden the real cause and shipped a second
bug. A test asserts both survive.

### Tests

5 in `a-sheet-must-escape-the-page-transform.test.ts` — and it guards **all three** full-screen
sheets, not just the one that broke, because a `fixed inset-0` overlay rendered inside the page tree
is a bug waiting for a transformed ancestor, and this app always has one.

Mutation-checked: un-portalling the sheet (the original bug) turns it RED; dropping the mount guard
turns it RED; "fixing" it by deleting the right dock turns it RED.

SPEC IMPACT: None — a rendering-boundary fix. No schema, SKU or price change.
