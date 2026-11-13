## 2026-11-13 · fix(wedding-onboarding): couple walkthrough C1 — the address, the double tap, the area, a made-up schedule day

From the controller's 390 px couple walkthrough (couple testnayan3, event wanda-indigo):

- **F-W2-12** The sign-up summary's "your page" address was its own spelling (`bride + "and" + groom` →
  setnayan.com/wandaandindigo, a 404); it is now `slugify(weddingEventName(state))`, the same as step 2 and the commit.
- **F-W2-03** The shared onboarding `StepBar` takes ONE press per step: drawn pressed at once (`data-busy`), further
  presses ignored until the step changes (`stepKey`) or 700 ms pass after a refusal. Wedding, generic and Simple flows.
- **F-W2-02** One picked area is written as the event's City or area (`std_film_venue_city`, `onePickedPlaceName`);
  two picks stay two regions.
- **F-W2-01 (part)** With no event date, Home's schedule says the clock only — its blocks sit on a seeded placeholder
  day (`anchorIso`: six months from seeding), which it printed as "Thu, May 13".
- **F-W2-01 (core) / F-W2-32** Owner ruling 14 Nov 2026 (specs DECISION_LOG 16f7e76a, "Yes, save it"): a wedding
  whose couple picks exactly ONE date at sign-up saves it as `event_date` (day precision; the existing
  `sync_event_date_status` trigger locks the status); two or more picks stay `date_candidates` until a venue is booked
  (`singlePickedWeddingDate`). Papic's window is read from `event_date`, so it switches on for the one-pick case.

SPEC IMPACT: Implements the owner's 14 Nov ruling already in the corpus (DECISION_LOG 16f7e76a); nothing new to write.

## 2026-11-13 · fix(wedding): a wedding with no venue type is "Not set", never a default "Banquet hall" (F-W2-02)

Owner, 13 Nov 2026: "not set". Migration `20271345020514` relaxes `events_wedding_fields_consistency` so a wedding needs
its ceremony type but its reception `venue_setting` may be NULL (a non-wedding still carries neither). The wedding
onboarding now stores NULL when the couple picked no reception setting (`venueSettingForReceptionPicks`), and Details
already draws NULL as "Not set". Existing rows are not rewritten: a stored 'banquet_hall' may be a real pick.

SPEC IMPACT: None (the owner's ruling is recorded by the controller in DECISION_LOG "FIVE OWNER ANSWERS IN ONE MESSAGE").
