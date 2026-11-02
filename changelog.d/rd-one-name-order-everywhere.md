## 2026-10-21 · fix(names): one order for the couple's names, set in Event Details › Event name

Owner: *"it should be Indalecio & Claire. And the title should be consistent"*. Event Details › Event name rebuilt the
line from the two people with the bride first ("Claire & Indalecio"). The cover, page title, link picture, prints and
passes, Home and the emails all read `events.display_name` as stored ("Indalecio & Claire"). Keeping any name in Event
Details also wrote the bride-first order back. Now:

- `lib/typed-names.ts` is the one helper. `nameOrderOf` reads the order from the stored name, and `coupleNameColumns(a, b, order)`,
  `joinCoupleNames`, `coupleNamesLine` and `coupleFirstNamesLine` compose every pair of names.
- Event name shows the stored line, and a new **Name order ▾** dropdown is the one place the order changes (one drafted
  write of the same name columns, which goes live at Apply). The Maker's Names editor and the Personalization writer
  (`updateEventMatchCriteria`) keep the stored order.
- The details record's Names row, the email and claim-page fallbacks, onboarding's first name and previews, and the tour
  pages all go through the helper.
- Guard: `lib/one-couple-name-order.test.ts` checks four things: the order is read from the stored name; the cover,
  title, Home and ticket agree with Event Details for both orders; every `coupleNameColumns(` passes an order; and no
  `app/`/`lib/` line joins the two people with "&" outside the helper. Sabotaged 4 ways: red each time, green once restored.

No migration, and no new column, because `display_name` already holds the order. Existing events keep their stored name.

SPEC IMPACT: None. This implements the owner's 2026-10-21 instruction. No DECISION_LOG row existed for name order, and the
2026-10-07 row's line "composed from the first names, as the hero draws it" is now true in both orders.
