## 2026-11-25 · fix(account): final check area 1, batch a1-a4-account

Lane A fixes on sign-up, the You card, public profiles and group chat. No sign-in rule changed.

- **A1-061:** /signup no longer promises that a guest's photos move to the new account (sign-up has not done that since 30 Sep).
- **A1-064:** the /signup description makes no speed claim.
- **A1-065:** the password-reset refusal names the limiter's real 15-minute wait (`lib/password-reset-limit.ts`, one home for the numbers).
- **A1-062:** a refused You-card read shows "Couldn't read your details" instead of a blank card whose Done erased saved details; `saveYou` refuses when it cannot read the saved row.
- **A1-063:** the consent box speaks of Discover, not the retired Real Stories.
- **A1-070:** every public-profile read throws `PublicProfileReadError` when refused, so the page errors (and its cached copy keeps the last good version) instead of a 404 or "Nothing public to show yet".
- **A1-071:** the hidden-profile banner names Profile & settings › Privacy › Public profile and links to it.
- **A1-072:** a refused follow is said and the button returns to the truth.
- **A1-073:** the chapter page names the person as /u does and drops the unmeasured "Papic Memories" claim.
- **A1-005:** group chat Add and Leave throw on refusal and the strip says so; Join chat and New group say why they failed.
- **A1-008:** a failed groups read draws the plain name (no empty sheet); New group says it couldn't read instead of a 404 or an empty list; the ＋ list's "everyone is in" line fits groups.

SPEC IMPACT: None.
