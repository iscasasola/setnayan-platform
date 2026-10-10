## 2026-10-10 · fix(lab): the Maker lab's sample entourage is handed the default Name style

`app/dev/maker-lab/guest/lab-sample.ts` called `buildEntourage(rows)` with no Name style, which `the-name-style-reaches-every-formal-surface` (every formal name builder is handed the event's style) rightly refused. The lab has no event, so it now passes `DEFAULT_NAME_STYLE` (`lib/name-style.ts` — the style a new event has), with section order and role names `null` (the built-in order and words, what the omitted arguments already meant). Output unchanged.

SPEC IMPACT: None
