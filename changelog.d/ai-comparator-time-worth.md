## 2026-07-03 · feat(marketing): Setnayan AI comparator — "vs doing it yourself" = what your hour is worth

- Follow-up to the hours-to-hours fix: the DIY mode now answers **"what is your
  hour worth?"** instead of comparing raw hours. The person sets their own
  hourly rate on a **"My time is worth ₱__/hr"** slider (₱50–₱1,000/hr, default
  ₱150), the DIY hours are valued in pesos at that rate, and — like the hire /
  other-AI-apps modes — the result reads **"you save ₱X"**.
- All three compare modes are now peso-to-peso and unify on the same savings
  line; only the alternative's ceiling differs (hire ₱1,213,333 · apps ₱100,000
  · DIY = hours × your rate).
- Both DIY bars share one peso scale (ceiling = the hours' worth at the 26-month
  end), so raising the rate visibly shrinks Setnayan AI's bar and grows the
  savings. Both still rise with the months slider.
- Bar labels: `Your time · ₱181,950` vs `Setnayan AI · ₱20,474`; the hours +
  rate math (`1,213 h by hand × ₱150/hr`) is stated in the foot so effort and
  worth are both visible. Rate slider shows only in DIY mode.
- Removed the now-unused `AI_COMPARE_MINE_MAX_HOURS` constant from the prior
  hours-to-hours iteration.

SPEC IMPACT: None (marketing-copy/interaction change; catalog prices unchanged).
