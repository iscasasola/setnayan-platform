## 2026-10-20 · fix(maker): on the one-page Invitation the toolbar reads the page on screen — Cover Scene keeps its Opening and its lines

Owner, live (phone, Invitation, bar on "Details", Cover Scene picked): Style empty — *"cannot see the reveal"* — and
Edit only "Tap a name to edit that word." with no lines; then *"after pressing around, i see it now. but there is a
bug where it does not show properly."*

- **Cause.** The Invitation and Save the Date are ONE page (owner 2026-10-15), and the bar's tab follows the scroll.
  The toolbar read whether the Cover Scene leads (its Style = the Opening, `RevealPartTools`) and the cover's lines
  (its Edit) off the TAB's part list; "Details" lists neither, so both bodies were empty until a scroll moved the bar
  back to Home. A tap on a cover word there also named the Cover Scene instead of the word. Not introduced by
  #6686's lines (they do not touch these reads); the one-page Invitation exposed it.
- **Fix.** `makerPartsOnShownPage` (`lib/maker-parts.ts`): on a one-page stage, the parts of every tab sharing the
  page; `makerCoverLeads` · `makerCoverLineParts` read it, and so does `makerPartOfTap`. The Day and the RSVP stage are
  unchanged. The no-part tap from #6686 now lets the work area's body go only while nothing is picked.
- **Guard.** `lib/the-cover-keeps-its-tools-on-the-one-page.test.ts` (every tab of the one page sees the same parts;
  the cover leads and has its lines from each; each part's own tap names it from each; tabbed stages unchanged;
  wiring). `every-stages-tab-has-its-own-page.test.ts`'s cover needle repointed.

SPEC IMPACT: None (restores DECISION_LOG 2026-10-16 / 2026-10-17 Cover Scene Edit · Style as approved).
