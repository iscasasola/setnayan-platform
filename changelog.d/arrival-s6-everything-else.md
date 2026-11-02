## 2026-09-20 · feat(arrival): an "everything else" sheet gathers the guest doors the invitation never linked

Board 6 of the arrival redesign: a row + bottom sheet mounted once on the
event page (outside both the anonymous and guest identity trees, beside
`GuestDoorwayStrip`), listing every guest-facing door this viewer may use
right now — grouped ON THE DAY / ANYTIME. Each row is either a live link, an
inert row carrying the event date ("not yet — 18 December"), or omitted
entirely; never a link to a destination that would refuse the visitor.

New files only:
- `apps/web/app/[slug]/_lib/everything-else-rows.ts` — the pure resolver
  (`resolveEverythingElseRows`), fed exclusively by values `site-body.tsx`
  already resolves for its own rendering (`hostCameraOpen`,
  `doorways.venueWalk`, `plan.liveMediaVisible`, `recapBody`,
  `resolveEffectiveVisibility`) — no new database question.
- `apps/web/app/[slug]/_components/everything-else-sheet.tsx` — the trigger
  + sheet (built on the shared `Sheet` primitive, `z-50`, so it cannot repeat
  the retired `GuestHubBar`'s `fixed bottom-0` conflict with the nav bar).

`site-body.tsx` touched at one mount point (two imports + one block, mirroring
the existing `GuestDoorwayStrip` mount immediately above it) — no edits inside
either identity tree, the RSVP surfaces, or the day-of branch.

Not included: "Request a song" (Pakanta) — `SongRequestCard` renders inside
the guest tree only, with no anchor id to link to; wiring a real destination
needs an edit inside `site-body.tsx` beyond this slice's one-mount-line
fence. Flagged for a follow-up rather than shipped as a dead link.

SPEC IMPACT: None.
