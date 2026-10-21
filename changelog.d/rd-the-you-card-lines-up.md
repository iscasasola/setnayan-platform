## 2026-10-21 · feat(first-run): the You card's photo is one row that fits; SETNAYAN on every first-run screen; Done goes to the picker; a once-only welcome; "Then" on supplier Today

Owner, 21 Oct: *"i noticed some misalignment where they upload their first profile photo. on that page. can you show
me that step"* → on the prototype (`prototypes/first_run_you_and_next_steps_2026-10-21.html`): *"make it follow our
design template and rules. make each step simple and easy to understand as well"*.

- **The You card photo** (`/signup/you`). It measured as a 160 px circle in a 96 px column, spilling 64 px into a
  167 px Display name box that cut its own placeholder, and it said "Add your logo" to a person. It is now one row: a
  72 px circle (the one thing you press) beside plain words, "Your photo · Optional · PNG, JPG or WEBP · up to 2 MB".
  The row has five states: empty, chosen ("Not saved yet — press Done below" + Remove), uploading (the circle is the
  progress ring + Cancel), refused (terracotta-dashed circle, with the reason under the row) and saved ("Saved" +
  Remove). The Display name is now full width underneath. This is `FileUpload`'s new `row` prop. The shop logo keeps
  "Add your logo" (new `slotSays`; the profile passes "Add a photo"). The 160 px slot and the 132 px picture are now
  capped by their column (`max-w-full` + `aspect-square`).
- **Dark** for the sign-in, create-account and You cards, using the app's approved dark set. It is inert until a
  sign-in route joins `DARK_READY`.
- **SETNAYAN on every first-run screen.** `FirstRunBrand` (the shipped `Wordmark`, small) appears on sign-up, the
  You card, "What do you need?" (the generic wizard and the Get-together form) and every open-shop step. The picker
  sits in the app bar, which already carries the mark.
- **Done goes to the picker.** For an account with no event yet, Done and Later go to `/dashboard/create-event`
  (`youCardOnward`); an unread count keeps the board. The picker draws no "Back to events" when there is nothing
  behind it (`NewEventHead`).
- **Welcome, {name}.** `host_spotlight_v1` opens on the Event Home with a once-only welcome: the larger mark,
  "Welcome", not counted in "Step N of M", and skipped on a replay (`spotlightSteps`). After it come the shipped
  steps.
- **Supplier Today "Then".** Under a setup Next card it lists the rail's next two steps, then the approval
  (`firstStepsThen`), as hairline rows. The order is unchanged: details → first service → documents.
- Consent words: "Include my **events**" (it said "celebrations").
- `/dev/you-lab` is new: the You card states, the picker in the app bar, and the open-shop wizard. The other two labs
  gain `/dev/home-lab?spot=1` and `/dev/supplier-lab?easy=setup&rail=service|docs`.
- Guards: `the-photo-lines-up-with-its-name.test.ts` and `lib/first-run-screens-carry-the-brand.test.ts`.

SPEC IMPACT: `DECISION_LOG.md` gets a row (2026-10-21) for the first-run build and for the three controller decisions
the owner may veto: Done → picker; the supplier order is kept; a one-time welcome. There is no schema change.
