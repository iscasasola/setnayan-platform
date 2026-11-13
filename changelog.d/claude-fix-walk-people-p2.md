## 2026-11-13 · fix(people): walkthrough P2 — the reply dead end, a Get-together's lost date, its badge

- **F-W3-25** The cover's "Confirm attendance" for a reader the page does not recognise ignored the couple's reply
  window, so a guest could tap into "Replies are not open yet". `coverRsvpOf` now asks the window on that path too and
  draws the window's own line instead of a button.
- **F-W3-30** `/dashboard/create-event` (the door a Group's "Plan an event" opens) kept one picked date as a one-entry
  `date_candidates` list with `event_date` NULL — the Group's card read "TBD", and with no date the page never left the
  Save the Date (feeding F-W3-25). It now writes one pick of a fixed-date type as `event_date` (day), exactly as the
  onboarding doors do (`singlePickedDate`, owner 2026-10-08); a Group's card reads an older one-pick event's day
  (`withPickedDate`). Badge: `simple_event` reads "GET-TOGETHER" (the admin label), not "SIMPLE EVENT".

SPEC IMPACT: None.
