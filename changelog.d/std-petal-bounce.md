## 2026-06-21 · feat(std): veil petals bounce off the text + the controls stir the petals

Owner: "can they also bounce when they hit the texts? … the controls will run the petals and veil."

Two additive touches to the Save-the-Date veil reveal (`reveal/veil-reveal.tsx` + the press handler in `save-the-date-film.tsx`):

- **Petals bounce off the text.** Once the veil is up and the film's text is showing (`lift > 0.85`), a *falling* petal that enters the central text band (≈ the names/date) is deflected **up and outward**, as if the words are solid. One bounce per descent (a `pTextBounced` cooldown that re-arms when the petal climbs clear of the band), so petals dot around the text instead of jittering in place. Pre-clung/clinging petals are unaffected; the cling logic is untouched.
- **The controls stir the petals.** A press on the film (z-50) now dispatches a `std-veil-poke` event with the press point; the veil (z-60) listens and bounces the nearest petal there. So a press both *holds the film's autoplay* (release continues — unchanged) **and** knocks the petals — the controls run the petals, not just the film. (The veil + petals already animate on their own RAF loop, independent of the film's pause, so they keep running through a hold.)

Verified: `tsc --noEmit` exit 0; adversarial review (text-bounce correctness + cross-component poke / regression) clean. WebGL petal *look* is owner-verified on-device. CI (lint + build) + Vercel preview are the gate. Builds on the petal pre-cling (PR #1969) — touches different lines, no conflict.

SPEC IMPACT: iter 0024 Save-the-Date veil reveal — falling petals deflect off the on-screen text; a film press knocks nearby petals. → DECISION_LOG row.
