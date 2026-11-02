## 2026-06-25 · fix(a11y): name the icon-only controls that lacked an accessible name (item 1/4)

App-wide a11y audit (13-agent fan-out + switch/tab blind-spot check) found only
4 icon-only/glyph-only interactive controls with no accessible name — a WCAG
4.1.2 gap (screen readers announce them as just "button"). Named all four:

- `live/_components/flash-auto-wall-toggle.tsx` — `<button role="switch">` inside
  a `<label>` (a wrapping label doesn't name a button) → `aria-label="Flash auto-wall"`.
- `seating/lab/_components/seating-lab-3d.tsx` — bare `✕` dismiss → `aria-label="Dismiss notice"`, glyph wrapped `aria-hidden`.
- `papic/guest/_components/papic-guest-capture.tsx` — send button (`↑` / spinner) →
  `aria-label="Send"` on the button so the name survives the state swap.
- `components/loading-activity.tsx` — carousel pagination dots → `type="button"` +
  `aria-label="Go to tip N"` + `aria-current` on the active dot.

The audit + completeness critics confirmed these are the ONLY such violations
app-wide (all other switches/toggles already carry aria-label or sr-only text).
Verified `ship` by a 9-agent adversarial pass — labels accurate, no regressions.

SPEC IMPACT: None — a11y correctness, no schema/SKU/pricing/flow change.
