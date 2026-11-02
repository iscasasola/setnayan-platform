## 2026-07-11 · style(schedule): Journey rows drop the redundant same-year stamp

Visual polish on the Journey view (PR #3100). Each timeline row printed the year under the month/day (`MAR 10` / `2026`), so a single-year arc stamped "2026" on every row — pure noise, since the arc header already anchors the years ("Jan 5, 2026 → Jun 14, 2026"). Now the year renders **only when it differs from the current year**, so a same-year arc reads clean while a cross-year engagement (e.g. planning in 2026 for a 2027 wedding) still shows the year where it matters. Confirmed against a rendered mock of the view.

- `app/dashboard/[eventId]/schedule/_components/journey-view.tsx` — the year `<span>` is now conditional on `entry.date.getFullYear() !== new Date().getFullYear()`.

SPEC IMPACT: None (cosmetic).
