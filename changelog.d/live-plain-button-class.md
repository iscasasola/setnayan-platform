## 2026-11-15 · fix(live): server pages import the plain button class

`actionButtonClass` lived in the `'use client'` `components/action-button.tsx`, and three SERVER components called it
during render — Next refuses that ("Attempted to call actionButtonClass() from the server"), so the page errors:
`/admin/event-deletions` (each open request's buttons), `/dashboard/[eventId]/guests/claims` (each pending claim) and
`/dashboard/[eventId]/sponsors` (SponsorCard, server-rendered, for an "invited" sponsor). The builder and tone list
move to the plain `components/action-button-class.ts` (re-exported by the client file, so other imports keep
working); the three files import from it. Guard: `lib/a-server-file-calls-the-plain-class.test.ts`. Split out of
#7728 / #7711 to ship alone as a live fix.

SPEC IMPACT: None.
