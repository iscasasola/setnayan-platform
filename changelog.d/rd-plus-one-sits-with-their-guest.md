## 2026-10-20 · fix(guests): a +1 sits with their guest — in their section, right under them, named with them

Owner on cale-ice's Guests › List: *"the plus 1 did not connect properly to the guest"* — GUESTS opened on a run of
identical "+1 · TBA · To invite" rows. The rows were linked (`guests.plus_one_of_guest_id`); the List bucketed each
+1 by its own role/side/name. Now (`lib/guest-roster-view.ts`):

- every Sort sections a +1 as their guest is (role, last name, side, group) and draws it right after them; the RSVP
  Sort alone reads the +1's own answer (its headings are answers). The map uses the same sections, and "By side"
  follows the guest's side.
- an unnamed seat reads "Juanita Sacdalan’s +1 · TBA" (the seat's own "+N · TBA" label, numbered per guest); a named
  +1 reads "Paulo Reyes · +1 of Andrea Flores"; the dot shows the guest's side; no divider between a guest and their +1.
- searching a guest's name brings their +1s; reply words ("to invite", "attending") still match each +1 on its own answer.
- write time: setting a guest's side (inline, bulk, the card's save via `syncExtraSeats`) carries it to their +1s
  (`carrySideToTheirPlusOnes`). Existing drifted rows are NOT rewritten (owner question in the PR).

Counts unchanged: each +1 is still one guest row; section "· N" follows where it is drawn.
Guard: `guests/_components/a-plus-one-sits-with-their-guest.test.ts` (4 sabotages seen red).

SPEC IMPACT: None — display and write-time consistency of an existing link; no ruling changed.
