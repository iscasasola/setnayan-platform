## 2026-11-19 · feat(icons): sliders is the one sort / show icon app-wide

Owner, 19 Nov 2026: "use that as the default icon for sort across the app".
Every control whose job is to sort, show or filter a list now draws lucide
`SlidersHorizontal` at stroke 1.9. Icon only — no layout, copy, behaviour or
size change.

- **Swapped (12 screens):** Admin › Disputes filter row and its Apply button ·
  Admin › Connection logs "Type" pills · Library Memories thumb row · People
  roster and People view picker · Guests filter menu · Schedule "View as" lens ·
  Find a supplier "See all" door · Supplier Today thumb row · Portfolio thumb
  row · Offers "Show" menu · Shop services thumb row.
- **Left on purpose:** `ArrowUpDown` on Portfolio "Reorder" and on the Schedule
  "Shift everything after" button (both move things, neither sorts a view), and
  the `/admin/menus` icon catalogue in `lib/nav-icons.ts`.
- **Guard:** `apps/web/lib/sort-icon-is-sliders.test.ts` fails when any file
  imports a funnel, list-filter or sort-arrow icon from lucide-react outside a
  named, reasoned allowlist — and when an allowlist line stops being true.

SPEC IMPACT: None — implements the 2026-11-19 DECISION_LOG row
