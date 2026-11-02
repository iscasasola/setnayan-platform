## 2026-10-19 · feat(guest-desk): the guest's Event Hub on a desktop — the approved system sheet's top bar, two widths and side panels, dark (desktop area 1, part 2)

Owner ruling: DECISION_LOG 2026-10-15 "ONE-PAGE INVITATION + SAVE THE DATE, THE DESKTOP SYSTEM SHEET, AND FIVE ANSWERS —
APPROVED" (`prototypes/event_hub_one_page_and_desktop_2026-10-15_fable.html` § 2 — the seven pieces — and § 4 C). Built
from the approved sheet ALONE (the separate `event_hub_guest_desktop_2026-10-15_fable.html` has no approval row and is
not used). DARK: `guestHubDesktopEnabled` (`NEXT_PUBLIC_GUEST_HUB_DESKTOP_ENABLED`, or an internal §10a viewer) — every
guest keeps today's page.

- **The top bar** (piece 1): the shipped sticky header (× · Setnayan · the stage word) is the bar; the page's slots sit in
  its centre (520 px), icon + word as 44-px pills, the lit one tinted; the corner (music · Account) stays on its right
  and the header's right cell keeps clear of it (under 1280 the stage word gives it the room). The floating xl rail and
  the bottom bar are retired; over the cover the bar is held off with the header and slides in with it.
- **Two widths** (piece 2): the stage is 64 rem, or the window less 64 px at 1024; the 76-rem ceiling (it cleared the
  rail) goes. Scenes keep their own reading column.
- **Side panels** (piece 3): the shared `Sheet` (gift · wish sheets), "Open in your browser", the hub's "More" and a story
  moment open as 440-px panels from the right over their own scrim; Escape and focus return are each sheet's own
  `useModalA11y`, untouched.
- **Rings** (pieces 5 · 6 · 7): one 2-px #A9834B hover ring and the ink focus ring on the bar's slots; the corner's chips
  44 px.
- CSS ONLY (`lib/guest-hub-desktop.ts`), every rule inside `min-width:1024px`, written by the guest page only for the
  viewers the flag lets in (never in the Maker's canvas) — a guest's page, and every phone, is the same bytes.
- Guard: `lib/the-guest-desktop-is-the-system-sheet.test.ts` (dark; never a phone; the sheet's pieces; the rules still
  find the shipped markup) — sabotaged 4 ways, red each. The flag joins `flag-chokepoint-scan.test.ts`.

NOT IN THIS PR (named — the sheet is silent, or another ruling came after it): the Reply as a side panel — since
2026-10-11 ("ONE REPLY FORM") the guest's Reply is the `/invite/reply` PAGE, not a sheet, so there is no sheet to turn
into a panel (owner call: panel the page, or keep the page); the "Skip to content" first Tab stop and ← → between the
bar's slots (piece 7's keyboard notes — DOM, next slice); the one-page Invitation itself (§ 4 A, a phone change, ships
with its own Event Hub batch); the shared `desktop-system/` components and its repo-wide guard (§ 4 B) — this slice
uses the sheet's measures on the guest page only.

SPEC IMPACT: None — builds the approved system sheet; the gaps above are named for the owner.
