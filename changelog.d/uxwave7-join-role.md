## 2026-06-20 · feat(join): "Guest" is one tap — the 18 ceremonial roles tuck behind a disclosure

2-step-down program (Wave 7, guest-join). The accountless + signed-in join forms already defaulted the role to Guest, but showed all 18 ceremonial roles in an open `<select>` — friction for the ~everyone who's just a guest. Both forms now lead with "You're joining as a Guest — right for almost everyone" and tuck the full role picker behind a "My role is special — sponsor, bearer, entourage…" `<details>`. The hidden select still submits its default `guest` when collapsed, so the common case is a true one-tap (name → submit).

No schema change. tsc clean.

SPEC IMPACT: iteration 0000/0001 guest-join UX. Logged in `DECISION_LOG.md`.
