## 2026-10-09 · refactor(guests): the dev lab's guest card is pressable without reaching the database; the lab's Finalize flip follows

Step 4A. `GuestCardBody` takes an optional `actions` prop (the three writes its forms post); every real page leaves it out and gets the shipped `updateGuest` / `releaseGuestClaim` / `inviteGuestByEmailAction`, the dev lab hands in inline stand-ins that write nothing (and, with `?refuse=1`, refuse in the database's own words so a guard can prove the card never prints them). The card's ⋯ takes New QR / Unlink from the lab's context. The lab's successful Finalize now moves the fixture's `?hc=` with `router.replace` (a `replaceState` + `refresh()` was not followed), so "Reopen guest list" can be seen and pressed. No request, no server action exported, no migration added.

SPEC IMPACT: None
