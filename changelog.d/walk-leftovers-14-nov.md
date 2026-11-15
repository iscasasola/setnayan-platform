## 2026-11-14 · fix(walk): one round of small leftovers from the 14 Nov live walkthroughs

- **Names, never a stand-in.** `accountPersonName` (the one place a group names an account) and the public person page
  `/u` run the stored display name through `realNameOrNull`, so a stored "Someone —" falls through to the account's
  first + last name, then to a neutral word. `/u` no longer prints the raw `S89U-…` address as a handle for an account
  with no slug; the share card and the new-group-chat picker follow the same rule ("A guest" when there is no name).
- **Couple onboarding.** The date step (4) wears the same `SetupFrame` as every other step ("4 of 10", the house
  title). The look picker (9) is one list — the ◆ on a name marks Pro — instead of groups split around "Free" under
  the retired plan name; the note says "Event Pro".
- **Shop page.** The About panel ("What their own website can't do") no longer draws a second Check a date — the
  header's button is the one door.
- **44 px.** Chat quote-card links (View quote and its row) and the Follow-gate Message buttons carry `min-h-11`;
  "Open mood board →" too. The couple's supplier card labels (★ Chosen, Verified, Setnayan, fit badges) are 12 px.
- **Plain words.** Supplier Shop captions, Today's "Needs you today" count (no "12 MN – 12 MN"), couple Home tile
  failure lines, and admin Problems lines (a read reads "Loading … — could not load", never "Saving …").
- **Titles.** The get-together page is "Plan a get-together".
- **Dates.** US-style dates on user-facing screens go through the app's Philippine formatter ("14 Nov 2026").
- Guards: `lib/the-walk-leftovers-14-nov.test.ts` (names, admin "X · Admin" titles, get-together title) and
  `lib/dates-read-day-month-year.test.ts` (no US-style dates).

SPEC IMPACT: None — copy, sizing and fallbacks only; no new design, no schema.
