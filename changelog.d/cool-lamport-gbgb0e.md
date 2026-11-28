## 2026-11-27 · fix(papic, panood): house pieces on the guest camera and Live Watch screens

Themes audit 27 Nov § Group G and the buttons audit, for `app/papic/**` and `app/panood/**`. Same screens, same behaviour; only the primitives move.

- **No spinners.** Every `Loader2` / `animate-spin` is gone. A working button says its step through `ActionButton`'s `busy` ("Saving…", "Sending…", "Starting camera…"). The Papic camera's starting cover says its step as a `Ghost`. The shutter stays held (`aria-busy`). The upload chip shows a still upload icon, and the Live Watch ingest strip shows an hourglass. REC and LIVE dots still pulse: those are live signals, not loading.
- **Hand buttons → `ActionButton`** in the Kwento decorator, the Papic buy panel, the pool grid, the demo flows, Camera Bridge, the guest Story maker, the order page, the camera's terms and Kwento sends, and Live Watch's program-output and demo-camera buttons.
- **Kwento decorator a11y fix (buttons audit).** The corner knob and ✕ were `role="button"` spans with pointer handlers only. They are real buttons now: arrow keys resize and rotate, Enter or Space deletes, and both press at 46 px (`sn-hit-2d`) without changing their drawing.
- **Scrims.** The Papic camera's starting cover uses the one scrim's camera depth (`--sn-scrim-solid` + `--sn-scrim-blur`) instead of `bg-ink/80`. The run-out cover keeps `bg-ink/85`: on the token's depth, a bright live picture washed out its message. That one is left for an owner call.
- **Colours → tokens.** `bg-white` → `bg-surface` on the Live Watch controls (the join QR keeps white so it scans). The dead `var(--m-grey,#8c8884)` → `--m-slate-2`. Emerald → the success ramp. The record ring reads `--color-terracotta`.
- Live Watch's Exit link presses at 44 (`sn-hit`).

Guard: `lib/papic-and-panood-wear-the-house-pieces.test.ts`. It was mutation-checked: putting a spinner back turns it red.

SPEC IMPACT: None. These are house-standard fixes to drawn screens.
