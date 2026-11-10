## 2026-11-10 · fix(motion): Rise full screen runs 0.7 s — one number, app-wide

Owner, 10 Nov 2026 (DECISION_LOG "SIX ANSWERS" (2)): *"0.7s"* — Rise full screen runs 0.7 s (`--sn-pill-dur`, the family speed); reduced motion stays a short fade. HOUSE_TEMPLATES T4 recorded main as still 520 ms.

Look-free plumbing — only the timing changes; the ease, frames, reverse and layout are untouched.

- `apps/web/app/globals.css`: `--sn-dur-rise` no longer carries its own number — it reads `var(--sn-pill-dur)` (700 ms).
- `apps/web/lib/rise-motion.ts`: `RISE_MS` 520 → 700 (the Web Animations mirror of the token). Every rise consumer already reads it — the picked client / picked supplier (`PickedShell`, `PICKED_OPEN_MS = RISE_MS`) and the supplier body panel (Makers, Portfolio albums).
- `apps/web/app/vendor-dashboard/collections/_components/collections-list.tsx`: the in-place open and its chevron hard-coded `'520ms'` ("the house 520 ms") — now `var(--sn-dur-rise)`.
- `--sn-dur-rise-reduced` / `RISE_REDUCED_MS` stay 120 ms (reduced motion = cross-fade, no movement).
- Comments that stated 520 ms for the rise updated; the two existing guards that pinned 520 now pin 700.
- Left alone on purpose: `calendar-day-box.tsx` `RETURN_MOTION` (520 ms on a different ease — the month's glide back, not the Rise).

Guard: `apps/web/lib/the-rise-is-0-7s.test.ts` — the token reads the 700-ms family speed, `RISE_MS` equals it, reduced motion is still 120 ms, and no file keeps its own rise duration (no numeric `RISE_MS`/`PICKED_OPEN_MS` outside the source, no second `--sn-dur-rise`, no `520ms`/`duration: 520`, no literal duration in any rise importer). Sabotaged three ways, each red.

SPEC IMPACT: None in this PR — HOUSE_TEMPLATES T4 "Shipped" line (`still RISE_MS = 520 on main`) and its "NO GUARD — needs one for the 0.7 s duration" become true once merged; the controller updates T4 after ship.
