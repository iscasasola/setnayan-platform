## 2026-06-22 · fix(onboarding): name / pax / budget use the two-pane desktop layout (maximize space)

Owner: "desktop is not maximizing space" — follow-up sweep after the date screen. The `name`, `pax`,
and `budget` screens still rendered as narrow centred columns in the wide desktop sheet. All three
already use the standard `.viewzone` + `.tapzone` skeleton, so opted them into the two-pane layout —
hero/headline LEFT, control RIGHT — consistent with role/kind/faith/date. Mobile (<1024) unaffected.

- `onb-twopane` added to the `name`, `pax`, `budget` `<section>`s.
- `onboarding-desktop.css`: `.paxphoto` + `.budgetphoto` added to the left-column photo-fill rule
  (so the photo covers fill the left column like role/kind/faith), and `#screen-pax` / `#screen-budget`
  removed from the single-column 720px-cap list (they're two-pane now, not capped). `name`'s monogram
  sits at its natural size (it's a mark, not a full-bleed photo).

Browser-verified at 1280px: name (monogram left, fields right), pax (photo left, slider right),
budget (photo left, slider right). tsc 0 · `next lint` clean (one pre-existing unrelated warning).

SPEC IMPACT None (desktop-only layout consistency).
