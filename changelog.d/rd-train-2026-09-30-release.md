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
- **Server-action budget**: #6176's dev-only lab's four exports became one bound
  `labRsvp(kind, …)` — 1225 of 1225, ceiling unchanged.
- Port-control + dup-rule baselines regenerated once, after the fold.

SPEC IMPACT: None (each folded PR carries its own).
