## 2026-08-21 · feat(story): a column the couple writes themselves

The story page ships thirteen sections. A couple could already hide any of them
and reorder eleven — what they could not do is write one of their own. "The
Groom's Dog, A Retrospective" is not a section we will ever ship, and it is
exactly the kind of thing a story should have room for.

- `custom-columns.ts` (pure, client-safe, beside `editorial-order.ts`) —
  `readCustomColumns` · `sectionOrderToPersist` · the key namespace.
- Stored in `draft_json.customColumns`; placed through a namespaced order key
  `custom:<id>` so there is ONE ordering list and one answer to "what order does
  this page render in", rather than two that drift.
- 🔒 The resolver takes the couple's column ids as a WHITELIST, and every
  existing caller passes none — so a `custom:` key keeps being dropped exactly as
  today, and a deleted column can never leave an empty block behind.
- 🔒 Every field is re-validated on read. `draft_json` is a JSONB column a
  couple's own browser can write through PostgREST; a title read straight out of
  it lands in a heading. Malformed columns are DROPPED, never repaired — a
  silently truncated column is a sentence cut in half without telling them.
- The body renders as React children, never `dangerouslySetInnerHTML`.
- ⚖ Writing a column is FREE; MOVING it is the Editorial PRO perk that already
  existed. Adding a paywall would be a pricing decision, and a pricing decision
  must never be a side effect of a build. A free couple is told their column goes
  at the end rather than left wondering why the arrows are dim.
- 🪤 A guard I wrote here was DECORATION and is deleted: "an order carrying a
  column is never the default" cannot fire, because a `custom:` key can never
  equal a canonical one, so `isDefault` is already unreachable. The mutation run
  is what proved it — deleting the line changed no test result. The test now
  asserts the outcome instead of the dead branch.
- Widening the resolver's return type made four call sites fail to typecheck,
  each one a place that reasons about the shipped run; `shippedSections()`
  narrows at the boundary, checked rather than asserted.
- 21 tests; 9 mutations, each verified to land BY OCCURRENCE COUNT.

SPEC IMPACT: None — no price, SKU or locked decision moves.
