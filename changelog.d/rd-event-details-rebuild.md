## 2026-10-06 · feat(maker): Event Details is rebuilt — one button, own-editor items, one Your event form

Owner-approved (DECISION_LOG 2026-10-06 "APPROVED — EVENT DETAILS IS REBUILT: ONE BUTTON, OWN-EDITOR ITEMS, ONE
'YOUR EVENT' FORM"; "'WHAT TO BRING' JOINS THE PREPARE GROUP"; 2026-10-05 "THEMES ARE REPLACED BY THREE DIRECT
GLOBAL SETTINGS").

- **One button.** The Maker's top bar has ONE "Event Details" button; the separate Look chip is gone
  (`MAKER_TOOLBAR`). The phone's lower-third Global settings mirrors the list: Look · Story & plans · Your event ·
  Prints · Settings.
- **The list** (`DETAILS_ITEM_GROUPS`): Look = Background · Colours · Font · Music · Mood Board · Logo · Cover page
  (was Hero) · Reveal; Story & plans = Wedding March (now also Parents & hosts) · Love Story · Schedule · Seat plan;
  Your event = ONE scrolling form — Event Name (was Names) · Date · Venue · E-Gifts (on/off, the E-Gifts page's own
  manager for where gifts are received, the thank-you message) · Opening Line · Special Message · Event Hub Address ·
  QR Code settings; the prints stay at the bottom. Items that left the list stay addressable (hidden group) so the
  guided flow and old links still open them.
- **Look sections are items**: each opens the one Look panel on its section(s) (`LOOK_ITEM_SECTIONS`; Buttons rides
  with Colours) and they share the one page frame (`bodyAlias`). Never a blank panel.
- **Music**: the old "Music and backdrop" is Music alone (backdrop dropped — Background covers it), also Look › Music.
- **Moved out**: Plan it myself → the Event Details page's Services (the same `PlanMyselfSwitch`); Photos from guests
  → The Day's own photo scenes (already show/hide); RSVP → the RSVP stage (already there).
- **What to bring** leaves the Invitation's Welcome for the Details page, after Dress code and before the Entourage;
  The Day keeps its reminders.

SPEC IMPACT: None new — implements the 2026-10-06 rows above. Owner sign-off asked on: Buttons inside Colours; the
"Story & plans" heading; the phone menu listing the list's parts (not every item).
