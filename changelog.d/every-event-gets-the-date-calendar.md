## 2026-08-21 · fix(onboarding): every event gets the date calendar, not just weddings

Owner: *"our date of celebration should have that calendar with the hot date
legend. as before, but i do not see that on the on boarding of any event. We
used to allow multiple single dates and a 30 days range date."*

**RULE 0 — nothing here is new. It was a missing WIRE, not a missing feature.**
The calendar (4 candidate dates · a 30-day range · the predicted-demand tint)
has shipped since 2026-06-09 (PR #1167). It was declared INSIDE the 3,800-line
wedding onboarding shell, so it could only ever appear on a wedding. Every other
type reached `/onboarding/[type]` — live, and the path for all 15 non-wedding
types — which asked for ONE date in a plain box and then hardcoded
`dateMode:'specific'`, one candidate and a null window on commit, **even though
that payload has carried all four fields the whole time.**

* `DateCalendar` + `heatTier` + the date helpers **moved** to
  `app/onboarding/_shared/`. Moved, not copied — one source, so the flows cannot
  drift. The wedding renders `chrome='wedding'` (the default) and is unchanged.
* 🪤 **The recorded styling trap, avoided.** DECISION_LOG 2026-07-12 already paid
  for it: a wedding onboarding component reused elsewhere *"would ship UNSTYLED
  (its classes are `.onbw`-scoped)"*. The 32 calendar rules moved with the
  component, re-scoped to `.sn-datecal`, and every colour now goes through a
  `--cal-*` alias carrying its own fallback. **`.onbw` could not be reused as the
  scope — it is not a namespace, it paints a full-height flex page.**
* **The legend is new, and it is the owner's word for it.** The tint has been on
  those cells since June with nothing anywhere saying what it meant. Swatches
  reuse the cells' own `.heat-N` classes, so a legend can never describe a colour
  the calendar stopped using.
* 🪤 **"Another day" would have become a dead chip** — it focused a native
  `<input type="date">` and called `showPicker()`; that input is gone. It now
  brings the calendar into view.
* The draft carries the calendar's answer, so resuming no longer loses the
  extra days.

Tests: 12 (render + CSS-move + wiring). **17 sabotages, all landed by occurrence
count, all RED.** Baseline regenerated and audited: **0 destinations and 0
actions lost across all 402 routes**; the only block changes are the two type
identifiers that moved, and `DateCalendar` ARRIVING on `/onboarding/[type]`.

⚠ `heatTier` is tuned for weddings (Saturday prime · Dec/Jan/Feb/Nov peak ·
repeating MM·DD · Valentine's). Those pressures are real for any PH celebration
that hires suppliers, so the same ramp now shows everywhere rather than nowhere.
A per-type curve is a product decision, not a reason to leave the calendar off.

SPEC IMPACT: None — restores the owner-locked date model (`DECISION_LOG`
2026-07-12) on the flow that had lost it. A row is appended there.
