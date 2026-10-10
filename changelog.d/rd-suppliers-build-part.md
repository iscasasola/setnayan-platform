## 2026-10-10 · feat(suppliers): the Build body — This build, All builds, Save / Save as new, Book this build (Suppliers PR3)

The Build segment of the couple's one-screen Suppliers page draws what the
owner-approved prototype draws (`prototypes/suppliers_page_2026-10-07_fable.html`,
Build mode), in place of `BuildLocked` + `BuildCompare` (both still serve the
flag-off page, unchanged).

- **This build** — the open build's name and "· edited"; "N of M categories ·
  ₱total · same as “X”"; one line per category on the event: the booked
  supplier, or ONE dropdown (`PickMenu`) of the couple's own shortlist for it —
  priced and free on their date — or "Find in ‹Category›"; Booked · If you book
  these · Budget · Buffer ("Not knowable" while a price is missing — never a
  number); the fit line and "Help me choose".
- **All builds** — this build first, then every saved one: a swipe carousel on
  a phone, side by side on a computer; "Use this build" · "Delete this build";
  the build identical to the current picks is marked "· this build".
- **The bar** — "Saved" | "Save · Save as new" | "Save this build", plus "Book
  this build" while a pick is not booked. It slides with the mode.
- **Twin detection** — `planSaveAs` (extended, not forked) refuses a save that
  would make a twin of a saved build ("Already saved — exactly “X”") and says
  "Nothing changed" for an unchanged open build; the same pure compare
  (`buildKeyOf`) draws "same as …" on the screen.
- **Book this build** — a loop over the shipped `finalizeVendor`, one pick at a
  time, posting what each Book button posts. A date that becomes official and
  the builds or suppliers a booking closes are confirmed ONCE, together; a time
  slot, reservation terms and a first payment keep their own shipped step and
  are listed with the door to that supplier's card; a pick taken on the date is
  never sent.

Every write is a shipped action (`setBuildPick` · `removeBuildPick` ·
`savePlanBuildNamed` · `applyBuildToWorking` · `deleteBudgetBuild` ·
`finalizeVendor`). No migration, no new table or column, no new server action.
A build saved from this body holds the booked suppliers and the picks only —
the old "Current" column saved the first shortlisted supplier of every category.

New: `lib/suppliers-build.ts`, `lib/book-this-build.ts`,
`vendors/_components/build-body.tsx`, `vendors/_components/book-this-build.tsx`,
their tests, and the lab's Build fixtures (`/dev/suppliers-lab?tab=build`).

SPEC IMPACT: None applied. For the owner to rule on (listed in the builder's
report, not written to the corpus): Delete and Use are immediate with an Undo
toast, as the prototype draws, where the shipped page asked first; the combined
booking sheet's own words; the fit line's "· N not checked".
