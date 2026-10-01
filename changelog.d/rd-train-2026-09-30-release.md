## 2026-09-30 · chore(train): RSVP + Invitation release (Oct 1) — 14 branches folded

One branch carrying only the RSVP + guest Invitation work (plan:
`RELEASE_RSVP_INVITATION_2026-09-30.md`). Each folded PR keeps its own fragment;
this one records only what the fold itself had to decide.

- **Home loses the pass block** (ticket branch) over round-slot's `qr-slot` tag on it;
  the Digital ticket on Me carries the code.
- **No table on any ticket** — the ticket branch dropped the seat read from the pass
  kit; `TICKET_SHOWS_TABLE = false` (#6169); round codes grow with Arrive only (#6173).
- **Entourage** — #6165's heading-says-the-role (pairs on one line, `roleBesideName`,
  `headingNames`) now labels in the couple's words from `events.role_names` (#6170):
  `roleBesideName`/`roleBlocks`/screen-reader text pass `group.names`; a Best Woman
  is named by the heading, so no word beside her name.
- **RSVP reply takes no email** (#6157) — supersedes #6174's couple-row email gate
  in `submitRsvp`; its guard now pins the stronger floor (no `contact_email` read).
- **Maker RSVP stage** (#6176) on top of no-maybe (#6167) and no-email (#6157).
- **#6176's dev-only `/dev/rsvp-stage-lab` is left out of the release** (it 404s in
  production anyway). Its four exported actions put the fold at 1228 of the 1225
  server-action ceiling, and its static import of the RSVP stage split the
  `maker-details` modules into extra async chunks. That pushed the shared bundle's webpack
  runtime over 202KB. Without it: 1224 actions, shared 17 B under 202KB (main is 7 B under).
  Re-add it after the release by importing the stage from `details-lazy.tsx`.
- **Maker first-load budget** (511.0KB → 503.2KB of 505, ceiling unchanged): the
  element sheet, the scene's bound-fact box and the Look pages' Details editors now
  load on a tap from the existing `maker-details` chunk (details-lazy.tsx, idle-prefetched).
- **Production build**: #6170's role-name read in `EditorialContent` skips curated
  samples (no event row; /realstories prerendered without a service key).
- **db suite**: #6176's Maker sample guest carried `entry_source='guest_list'` — now
  `host_seeded`; exposure baseline regenerated for #6170's deliberate
  `GRANT SELECT (role_names) ON events TO authenticated`.
- Guards re-pointed where one folded PR moved another's anchor (property kept each time).
- Port-control, dup-rule and exposure baselines regenerated once, after the fold.

SPEC IMPACT: None (each folded PR carries its own).
