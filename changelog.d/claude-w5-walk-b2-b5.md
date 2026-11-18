## 2026-11-18 · fix(public): W5 walk B2-B5 — 44px presses, two tagline words, one "Setnayan" per tab title

- B2: sidebar Company/Legal links, front-page "See the Event Hub Maker" / "All features…" / "Open a shop — free" / footer links, header Sign in (marketing nav), footer DPO address, login "Stay signed in" label and "Forgot password?" are 44px boxes (the 44px floor in globals.css never reaches `<a>`; no new class).
- B4: "Another year, celebrated." → "Another year, with your people."; Gala "black-tie celebrations" → "black-tie events" (migration, guarded on the old text).
- B5: supplier shop title is "Name · Supplier · Setnayan"; a non-public /u/ page is "Profile · Setnayan".
- B3 (hydration #418 + 404) NOT fixed: no cause confirmed from code alone — see the PR body.

SPEC IMPACT: None (copy + CSS; owner OK pending for the two taglines).
