## 2026-07-03 · feat(home): 3D Plan demo — free "Walk around" mode joins "Show my seat"

Owner request 2026-07-03 ("we want to show show my seat or walk around the
event"): the phone-side 3D Plan demo now offers BOTH experiences.

- **Where am I seated?** — the existing scripted entrance→seat walk,
  unchanged.
- **Walk around** (new) — free roam: tap anywhere on the floor and the guest
  figure walks there, using the SAME `steerPath` obstacle avoidance and the
  same chase camera as the scripted walk (no new movement engine — `Walker`
  gained a shared position ref so each tap paths from wherever the figure
  stands). The guest's own seat is marked with a gold ring + beacon, so
  "find my seat" still works inside free roam. Entering roam takes a small
  step-in toward the room so the chase camera settles facing the room, not
  a wall; offered both up-front (from the entrance) and after arriving at
  the seat (roam from there). Reduced-motion: taps teleport instead of
  animating. Roam walking speed is constant (~1.7 u/s, capped) so far taps
  don't fast-forward.
- Desktop overlay copy updated to sell both modes ("walk straight to their
  seat, or wander the whole room").

Verified: typecheck + lint clean, production build passes; live-verified
against prod data (minted a bound session for a real sample-event guest,
confirmed both buttons render, roam mode engages, seat ring labels the
correct table, floor taps execute with a clean console; test row deleted
after). The walk animation itself is the identical Walker/chase-camera code
path the shipped scripted walk already runs in production.

SPEC IMPACT: DECISION_LOG.md row 2026-07-03 (3D Plan demo walk-around mode);
memory `project_setnayan_homepage_demos_program` updated.
