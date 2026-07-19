## 2026-07-03 · fix(marketing): Setnayan AI comparator — "vs doing it yourself" compares hours to hours

- The DIY mode of the Setnayan AI pop-up rendered its top bar in **hours**
  (`Your hours · 1,213 h`) but the Setnayan AI row was hardcoded to the same
  **peso** label used by the hire/apps modes (`Setnayan AI · ₱20,474`) — one
  mode comparing hours against pesos.
- Setnayan AI now gets its own **hours** value in DIY mode: the ~2 h / 28-day
  cycle it still asks of you to act on the taps it sends
  (`AI_COMPARE_MINE_MAX_HOURS = 52`, ceiling at 26 months, scales × months/26).
  Both bars now read in hours and both rise with the slider, matching the
  "both bars rise" comparator design.
- Each mode carries its own `usLabel` (pesos for hire/apps, hours for DIY) so
  the render no longer hardcodes the Setnayan-AI-side units.
- DIY headline is now a single clean figure (`you get back N hours` =
  by-hand hours − Setnayan AI hours) instead of a range, consistent with the
  two concrete bars; foot copy contrasts the two hour figures.

SPEC IMPACT: None (marketing-copy/units fix; comparator maxima unchanged).
