## 2026-11-01 · feat(guests): "Guests of [Role]" on Guests › List — each role counts its own people

Builds the owner-approved prototype `prototypes/guests_of_each_role_2026-11-01/` (DECISION_LOG 1 Nov, "GUESTS › LIST:
\"GUESTS OF [ROLE]\" APPROVED"), its Proposed view, with the owner's one change: a plain guest's +1 stays in Guests
("They can stay on guest already. Since they are both guests") — there is no "Plus-ones of Guests" group.

In the Role grouping (`rosterSections`, `lib/guest-roster-view.ts`, through one new answer `roleSectionOf`):

- each role section counts only the people who hold that role;
- right after it, "Guests of [Role]" counts the +1s that role's holders bring who have no role of their own — each
  row reads "Name · guest of Host ↗", and ↗ scrolls to the host's row and lights it;
- a +1 who holds a role of their own is listed and counted once, in that role (with "· guest of Host ↗" on the meta
  line), and appears in "Guests of [host's role]" only as an uncounted jump row ("Ana Reyes · Bridesmaid ↗ — Listed
  under Bridesmaids · not counted here");
- the host's "+N ↓" jumps to their guests; empty groups are not drawn; the sections add up to the total;
- Honour attendants stays as shipped (#7141); a couple's roleless +1 is counted in Guests.

The Map (By role, and By side's role leaves), the search ("guests of groomsmen" finds exactly the people that heading
counts) and the shared PDF read the same sections. Other groupings (Side, Last name, Group, RSVP) are unchanged.
`/dev/guests-lab?part=screen&roleplus=1` draws every case on fake data.

Guarded by `app/dashboard/[eventId]/guests/_components/guests-of-each-role-add-up.test.ts` (red on a full revert and
on four targeted sabotages); `a-plus-one-sits-with-their-guest.test.ts` now expects the Role grouping's rule.

Also, the owner's 1 Nov ruling on the same headers (verbatim: "Edit icon only shows when the group is picked and
highlighted"): a List header's ✎ is drawn only on the header that is open (its chip lit — the shipped open state, no
new one), never on every header at rest; while shown it is a real, named button the keyboard reaches. "Guests of
[Role]" headers never have one. Guarded by `a-header-pencil-shows-only-when-picked.test.ts`.

SPEC IMPACT: None — implements the 1 Nov DECISION_LOG row as approved.
