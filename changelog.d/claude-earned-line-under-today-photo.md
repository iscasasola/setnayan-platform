## 2026-11-13 · fix(today): the "You earned …" line sits under the Today photo

Owner, live shot of supplier Today at phone width: the "You earned SETNAYAN Verified" line was drawn between the top
bar and the Today photo, so the photo started lower and the header looked cut. Ruling: "Under the Today photo".
`SupplierTodayScreen` takes the line as an `earned` slot and draws it right after the cover; a new shop (no photo)
gets it above its six steps. Guard: `the-earned-line-sits-under-the-photo.test.ts`. The top bar's 44px round
buttons are unchanged (the 44px press floor is the owner's rule).

SPEC IMPACT: None
