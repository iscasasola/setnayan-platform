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
- **F-W2-01 (core) / F-W2-32** NOT changed: owner ruling 2026-11-13 ("ONE MAIN DATE SPAN… candidates are options until
  a venue is booked") keeps a wedding's picked date as a candidate. Question on the PR.

SPEC IMPACT: None (no ruling changed; one question on the PR).
