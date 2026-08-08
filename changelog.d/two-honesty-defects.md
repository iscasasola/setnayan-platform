## 2026-08-08 · fix: a control that did nothing, and a link that went nowhere

Two defects found while specifying the Warm Editorial port, both verified against the
shipped code before touching anything. Neither errors; both just quietly fail a person.

**1 · "Mark all seen" was a fake door.** On the vendor Overview's "What's new" header it
rendered as a bare `<span>` — no `onClick`, no `href`, no form. It looked pressable and
did nothing. No bulk-acknowledge action exists for those cards, so the honest fix is to
remove the affordance rather than invent one. ("No fake doors" is a standing lock, and
this is the one deletion the vendor spec sanctioned.)

**2 · The vendor shop's "show more reviews" link jumped nowhere.** Pagination links to
`?reviewsPage=N#reviews`, and **no element carried `id="reviews"`**. So a couple asking
for more reviews got a page reload that dropped them at the top of a ~3,700-line shop
page, with the newly-loaded reviews somewhere far below. Fixed by giving the anchor its
target — one attribute — rather than removing the fragment, because the intent was right
and only the landing spot was missing.

🪤 **A JSX comment cannot sit above a `return (` root.** Two attempts to explain the
anchor inline created a second root element and broke the file; `tsc` caught both. The
explanation lives here instead, and the code change is a single attribute.

Typecheck clean · all 12 `lint-*.mjs` clean · **7092/7092** tests green.

SPEC IMPACT: None.
