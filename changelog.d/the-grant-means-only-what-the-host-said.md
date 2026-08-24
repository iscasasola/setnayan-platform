## 2026-08-25 · fix(access): a delegate's grant means only what the host named

The owner was asked directly who may see an event's guest list and answered:
*"no. only the owner of the event and coordinator (by request)."* The host half
already worked. The request half did not — for two reasons, both measured
against production before a line was written.

**The read policy on the guest list never asked which areas were granted.** Its
write twin has always asked. So a host who declined the guest list line by line
on their access-requests screen closed the screen and not the door: `guests` is
served over PostgREST to a public anon key, so the rows stayed readable to that
session.

**And the resolver handed out areas nobody granted.** `moderator_area_level`
fell back to the legacy `edit_all` / `checkout` flags for any area an `areas`
map did not name. That fallback exists for rows written before `areas` did —
the couple's own host rows, which carry no `areas` key — and it still works for
them. It was also firing on rows that *do* carry an `areas` map, where an
unnamed area is not a gap but a line the host did not grant. Measured on the
one external planner live in production, granted `{"areas":{"seat_plan":"view"}}`
and nothing else: she resolved to **view on guest_list · seat_plan · schedule ·
vendors · invitations · mood_board** — five areas nobody gave her.

🚨 **Closing one of two doors closes nothing.** `guests` carries a second read
policy, `event_member_can_read_guest`, and migration `20271161203067` mints a
`coordinator` member row for every accepted delegate. Policies are OR-ed, so
narrowing `guests_moderator_read` alone would have changed nothing and looked
complete. Both now ask the same question; the couple's own path is untouched.

Also corrected: `answerAccessRequest` seeded a self-requested planner from
`PERMISSION_TEMPLATES.wedding_planner_external`, described in its own comment as
*"the narrowest template"* while carrying `edit_all: true`, `checkout: true` and
`invite_hosts: true` — the widest a delegate can hold. It now seeds from
`viewer`, and what they may touch comes only from the lines the host said yes to.

🪤 **A mutation that stayed green found a fourth door.** Rewriting the couple
branch of the member policy to FALSE changed nothing — `couple_writes_guest` is
`FOR ALL` and already carries the couple's SELECT. Pinning that turned up a
fourth read path too: `guests_moderator_write` is `FOR ALL`, so it confers
SELECT as well. It is gated on `guest_list = 'edit'`, so it is not a hole, but
the table's read paths are now inventoried in a test rather than discovered.

6 mutations, each measured by occurrence count before → after; 5 red, and the
green one is written up above rather than filed as a pass. Whole db suite (1571)
and unit suite (9904) green. Exposure baseline regenerated: exactly two lines
change, both the intended narrowings.

⚖ **Deliberately not widened:** the moderator read policies on the seat plan,
schedule, suppliers and floor plan are left alone. The owner ruled on the guest
list; narrowing five more surfaces would be deciding four things he did not say.
The resolver fix already narrows what those areas resolve to.

SPEC IMPACT: DECISION_LOG.md — the 2026-08-24 guest-list ruling is now enforced
in the database, and the "an unnamed area resolves to view" behaviour recorded
in a test comment as "the DECISION" is retired; it was a legacy fallback nobody
had ruled on.
