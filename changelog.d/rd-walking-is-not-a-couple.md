## 2026-09-30 · fix(entourage): walking together is not being a couple

Owner, 2026-09-30: *"sometimes the principal sponsor are not couples. Or the
entourage are also not couples. Sometime they have their own +1"*. The Oct 1
release shortened ANY walking pair that shared a surname into the couple form
("Hon. Ricardo & Mrs. Jessica Villahermosa").

- **A walking pair prints both FULL names** ("Dr. Eduardo Bautista & Ms. Carmen
  Reyes") on the invitation, `/everyone`, the Maker and the printed Entourage
  card. The short form is used ONLY for a real couple: one is the other's +1,
  or the hosts ticked **"They're a couple"** on that pair in the Maker's Wedding
  March. A shared surname alone never shortens. One rule, `isCouple` in
  `lib/entourage.ts`, read by `lineNames` (so page and print stay identical).
- **"They're a couple"** tick in Details › Wedding March, on a picked two-person
  line. Drawn at the tap, saved behind it; a +1 pair shows it ticked and fixed.
  Stored as `guests.couple_with_guest_id` (migration
  `20271255652776_walking_pair_is_a_couple`), read as MUTUAL and only while the
  two walk together — so a swap or re-pair can never carry a tick onto a
  stranger. Written by `setWalkingPairCouple`, which took the export slot of the
  retired Guest-list "Pair these 2" (+0 server actions).
- **"Walks with" left the Guest list.** The row's "walks with <name> · Unpair"
  line and the bulk "Pair these 2" button are gone; pairing is set and shown
  only in the Maker's Wedding March. The guest card never showed it.
- **+1s** (their own guest rows) are verified never to reach the entourage or be
  offered as someone to walk with.
- Guards: `lib/walking-together-is-not-a-couple.test.ts` (same-surname
  non-couple stays full · +1 couple shortens · ticked couple shortens ·
  one-sided/stale tick does not · +1 never in entourage · every pair-line reader
  selects `ENTOURAGE_COUPLE_FIELDS` · no "walks with" on the Guest list or card);
  `the-heading-says-the-role.test.ts` and `a-pair-walks-as-one-line.test.ts`
  updated to the new ruling. Exposure baseline: +1 column
  (`guests.couple_with_guest_id`, same SIU as its sibling `pair_with_guest_id`).

SPEC IMPACT: None — implements the existing `DECISION_LOG.md` row "WALKING
TOGETHER IS NOT BEING A COUPLE" (2026-09-30).
