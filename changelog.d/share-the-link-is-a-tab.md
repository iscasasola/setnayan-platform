## 2026-09-21 · fix(guests): Share the link opens inside the guest list, not on another page

Owner: *"pressing buttons inside the guest list should not clear the whole page. only the body."*
Measured on the live page: Roster ↔ Wedding March kept the header on screen; **Share the link
removed the whole guest list 185ms after the click**, because it was a link to `/guests/invite`.

- The invite page's body moved, verbatim, into `invite/_components/invite-panel.tsx`. Both doors
  render that ONE panel: `/guests/invite` (unchanged for the sidebar and journey links) and the
  guest list's new `?gview=share` tab.
- The panel checks for the couple itself and never redirects (a redirect inside the guest list would
  throw the host off the page). Regenerate — which kills every printed QR — renders only after that
  check.
- Saving an invite look from the tab returns to the tab (`lib/invite-return.ts`, an allowlist — a
  tampered `return_to` falls back to the invite page).
- Guards: `guests/share-stays-on-the-page.test.ts` (tab renders the panel · one panel for both doors ·
  couple check before Regenerate · no redirect), sabotaged 3 ways; `roster-doors.test.ts` now pins
  Share as a tab. The QR-strip and gold-text registries follow the markup to the panel file.

SPEC IMPACT: None
