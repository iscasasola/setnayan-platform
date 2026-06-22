## 2026-06-22 · fix(onboarding): faith options are full-width rows on desktop (consistent with role/kind)

Owner: the ceremony-tradition (faith) screen rendered its options as a horizontal scrolling pill
row on desktop, while the role and kind screens lay theirs out as full-width rows (one per row).
Made them consistent.

Root cause: faith uses a `.chips` container (`#screen-faith .chips { display:flex; flex-wrap:nowrap;
overflow-x:auto }`), whereas every other option screen uses `.stack`/`.opt` — and the desktop
two-pane row treatment only targets `.stack`. Added an id-inclusive override in
`onboarding-desktop.css` (behind `@media(min-width:1024px)`) — `#screen-faith.onb-twopane… .chips`
flips to `flex-direction:column` and each `.chip` goes full-width, so the faith options stack one
per row like role/kind. Mobile (<1024) is untouched and keeps its horizontal scroll row; the locked
`onboarding.css` prototype is untouched.

Browser-verified at 1280px: faith options render as full-width rows (Catholic / Muslim / INC / …).

SPEC IMPACT None (desktop-only CSS consistency).
