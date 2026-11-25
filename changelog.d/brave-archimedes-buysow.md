## 2026-11-24 · fix(home): the profile photo is back at the top right of Home

Owner, 24 Nov, over a screenshot of another app's home: "keep what we have now and just return the profile icon on the upper right."

- Unihome v5 hid the account switcher's round photo in the top bar while Home was on screen. That one hide rule is removed, so Home shows the same photo-at-the-top-right as every other signed-in page, opening the same account sheet.
- Nothing else on Home changes: the ⚙ beside your name stays, the bottom bar stays hidden, the sections and the floating "Create an event" are as approved.
- Guard: `unihome-is-the-drawing.test.ts` now fails if Home's stylesheet hides the top-right photo again (mutation: re-adding the hide turns it red, 0 → 1).

SPEC IMPACT: DECISION_LOG row "Home keeps the profile photo at the top right" (amends one line of 23 Nov "UNIHOME v5 APPROVED": "no account switcher on Home").
