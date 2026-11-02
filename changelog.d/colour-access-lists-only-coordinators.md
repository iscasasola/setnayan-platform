## 2026-09-30 · fix(hosts): Colour access lists coordinators only — never the other half of the couple

The Hosts page's COLOUR ACCESS card (`CoordinatorColourDomains`, fed by
`colourGrantees` in `app/dashboard/[eventId]/hosts/page.tsx`) listed every
accepted host except the viewer, so the groom saw the Bride, Claire Buanhog,
under a card that calls her a coordinator, with four domain switches. Owner,
verbatim: *"Claire Buanhog is not a coordinator."*

Since `20271251336140_cohosts_come_from_the_guest_list.sql`, a full co-host seat
(bride · groom · partner1/2 · co_host · host · celebrant — `seat_is_full_cohost`)
becomes a `couple` member, equal to the creator, and `set_coordinator_colour_access`
only grants to `coordinator` members. So those switches were refused anyway; the
page's eligibility comment predated the co-host model. The list now drops every
full co-host seat through a new `seatIsFullCohost` in `lib/guest-access.ts`
(the existing TS mirror of the SQL function).

Guarded by `apps/web/lib/colour-access-lists-only-coordinators.test.ts`: the TS
kinds must match the SQL list, and the hosts page must filter with it (red without
the fix).

SPEC IMPACT: None.
