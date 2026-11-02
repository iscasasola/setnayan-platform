## 2026-10-12 · feat(suppliers): the Build body — This build, All builds, Save / Save as new, Book this build (Suppliers PR3) — and the supplier's yes, in the same words (pair P2)

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

**The supplier's half (pair P2, map rows 12–16; owner 2026-10-10 "a piece is not
working when only the couple's half exists").** One sentence per ask state,
spoken from each side (`lib/booking-ask-words.ts`): "Asked to book · waiting for
their yes / your yes", "… they said no / you said no", "… no answer in 48 hours /
you did not answer in 48 hours", "… you took it back / they took it back". The
couple's Build line and Find sheet now SAY a no, a lapse and a take-back (they
used to vanish — rows 14–15); the supplier's customer card answers the ask in
place (Agree · Turn it down post `return_to` = the card, which reads the answer
and says it — it used to throw the supplier to the Overview) and, once the ask
closed without a booking, says how, with when and their own words. Agree is the
terracotta main at 44 px on the card and the thread's quote card (2026-10-12
look calls 1 and 3). The fee: Agree posts `vendorAgreeToLock` only — the fee is
minted inside it on `rd/booking-fee-rules`; no fee code here (guarded).

Labs: `/dev/suppliers-lab?tab=build&build=answers&answer=requested|declined|expired|cancelled`
and `/dev/booking-ask-lab?s=requested|agreed|refused|declined|expired|cancelled`.

SPEC IMPACT: None applied (the words follow the 2026-10-10 pair rule). For the owner to rule on (listed in the builder's
report, not written to the corpus): Delete and Use are immediate with an Undo
toast, as the prototype draws, where the shipped page asked first; the combined
booking sheet's own words; the fit line's "· N not checked".
