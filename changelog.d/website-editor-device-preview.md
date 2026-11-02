# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · feat(website): preview as phone or desktop in the website editor

Owner ask 2026-07-25. A **Phone / Desktop** toggle sits beside the phase tabs in the editor's preview toolbar.

Because the preview is a **real same-origin iframe of the couple's actual page**, changing its width makes the guest site's own responsive breakpoints respond — so this shows the genuine mobile and desktop layouts, not a mock-up of them. Phone = 430px (the handset width the site is designed against); Desktop = the full preview pane, which on a laptop clears the site's `lg:` breakpoint. The width animates so the couple can see the layout reflow.

Defaults to **Phone**, since that's how most of their guests will actually open the site. Purely client-side view state — no reload, no round-trip, and nothing about the guest site changes.

SPEC IMPACT: None — a view control in the editor; no write path, no schema, no guest-facing change.
