## 2026-09-14 · fix(reveal): the cinematic reveal stops at the Save-the-Date

Owner, looking at his own invitation at `/cale-ice?phase=rsvp`: *"reveal should
only be at the save the date. remove it from this part of the event hub."*

**One rule, both doors.** `cinematicRevealPlays` is shared by the Event Hub body
and the invite link's first door (`inviteRevealPlays`) — named that way on
2026-09-10 so the second caller could not restate it and drift. Asked whether to
change the Hub alone or both, the owner chose **both**, so the rule stayed single
rather than splitting in two. The `rsvp` arm is gone; `save_the_date` is the only
stage that opens with a veil.

🔴 **This reverses the owner's own ruling of 2026-08-29** (*"event hub should
also have the cinematic reveal"*), and the reason recorded with that ruling is
the cost of reversing it — stated in the code rather than deleted: the
save-the-date window **ends 90 days out**, and inside those 90 days is when most
guests actually open the link. A couple who buys the Cinematic Reveal now has an
opening that plays only while the wedding is still distant. He was shown that
consequence and chose this anyway.

- `lib/site-body-plan.ts` — the `showInvitationReveal` arm removed; the docblock
  now carries both rulings and tells a future session not to "restore" the arm.
- `lib/the-reveal-reaches-the-invitation.test.ts` → **renamed** to
  `the-reveal-stops-at-the-save-the-date.test.ts` and inverted, rather than
  deleted, so the history of why it existed survives the reversal.
- `lib/site-body-plan.test.ts` (golden matrix) and
  `app/[slug]/invite/the-reveal-opens-the-invite.test.ts` updated — all three
  failed against the change before being updated, which is what proved they were
  real assertions and not decoration.

🔒 The wedding-only fence (`mayShowStdFilm`) is **kept** even though the phase
test now excludes a solemn event twice over. Removing a fence because the other
one currently holds is how one later change becomes an incident.

SPEC IMPACT: reverses the 2026-08-29 "the reveal also plays over the invitation"
ruling; the Cinematic Reveal (Event Hub Pro item 1) now plays in one stage only.
