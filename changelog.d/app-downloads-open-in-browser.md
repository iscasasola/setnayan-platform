## 2026-10-27 · fix(guests): ⤓ Excel saves the guest list instead of trapping the app on the file

Owner, 27 Oct (screenshot from the iPhone app): *"download excel on the app when pressed opened the file with no close
button and it did not download"* · *"shouldn't it try to open to if they have an app to open it. or save it?"*

- The Guest list's ⤓ Excel was a bare `<a href download>`. The app's web view ignores `download` on a same-origin GET
  and rendered the CSV in its only view — no way back, nothing saved.
- Now `GuestsExcelButton` (`guests/_components/guests-excel-button.tsx`) takes the tap and runs the save every Prints
  button already uses (`usePrintSave`): fetch with the signed-in session → the phone's share sheet (Save to Files, or
  open in Numbers / Excel / Sheets), a plain download on a computer. "Preparing…" while it is made; a refused or failed
  file says so beside the button. The link stays as the before-hydration fallback.
- Not the in-app browser (`lib/open-external.ts`): that sheet keeps its own cookies, is signed out, and would answer
  this private route with "Sign in".
- Guard re-aimed (`lib/guest-export-file.test.ts` 6): it pinned the bare link — the bug itself. It now requires the tap
  be taken over through `usePrintSave`. Sabotage: dropping `e.preventDefault()` → red; restored → green.
- Audit of every other download a signed-in user can reach found ~20 more with the same trap (calendar .ics links,
  Budget CSV/ICS, Papic photo zips, the import template, payment/pabuya QR saves, chat attachments); left for a
  follow-up sweep, not in this PR.

SPEC IMPACT: None
