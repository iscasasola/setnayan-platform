## 2026-07-16 · fix(guests): unify bride/groom/both side colours onto one shared map

The Atelier/glass reskin (owner-locked 2026-07-12) retinted the Guests roster
RowAvatar to the design-system side identity — bride → gold (`warn`), groom →
info-slate (`info`), both → a lighter gold — but never propagated it. The facet
dots, card rings, breadcrumb chips, guest-detail tint, groups sidebar, mind-map,
and ~half a dozen other side cues were still rendering bride in rose (`danger`),
groom in blue (`sky`), and both in purple (`violet`) — two contradictory
palettes for the same three sides on the same screens.

- New canonical module `lib/side-colors.ts` — the ONE side-colour map, keyed by
  three anchors (bride gold-500 · groom info-600 · both gold-300) and exposing
  named recipe shapes (`SIDE_HEX`, `SIDE_AVATAR`, `SIDE_DOT`, `SIDE_SWATCH`,
  `SIDE_RING`, `SIDE_CONTROL_BORDER`, `SIDE_CHIP`, `SIDE_CHIP_SOFT`,
  `SIDE_TINT_FILL`, `SIDE_ACCENT`, `SIDE_ROW_TINT`). `lib/seating.ts` now
  re-exports `SIDE_HEX` under the historical `SIDE_COLORS` name, so the seat map
  and the roster read from the same source.
- Swept every diverging guest surface onto the map: roster facet dots +
  breadcrumb chip (`page.tsx`, `active-filters.tsx`); card ring, avatar,
  SidePill, initials-fallback tint (`guest-list-multiselect.tsx`); guest-detail
  Side/group chip tint (`[guestId]/page.tsx`); groups sidebar row tint + inline
  dot (`groups-sidebar.tsx`); Side picker swatches (`chip-editors.tsx`); Side
  control border (`quick-add-sheet.tsx`); mind-map node accent
  (`guest-mind-map.tsx`).
- Guest-detail RSVP "Maybe" pill moved off `sky` to warm amber (`warn`), matching
  the roster's RSVP pills (amber = caution); corrected the stale
  "matches the established side-color convention" comment.
- Retired the last off-kit `violet` in the quick-add / name-field duplicate-match
  badges (a match-quality axis, not a side) to the sanctioned `info` neutral.
- Serif→sans sweep (typeface only, layouts untouched): create-event event-type
  photo/picker, library editorials tab, samahan community header — `font-serif`
  is retired from dashboards (Hanken display weight).

No data or behaviour changes; typecheck + lint + guest-legibility guard + local
production build all green.

SPEC IMPACT: None
