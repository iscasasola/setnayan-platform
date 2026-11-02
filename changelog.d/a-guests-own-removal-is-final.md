## 2026-09-16 · fix(papic): a guest's own removal of her photograph is final

`wall_unhide` authorised couple/coordinator/admin and then cleared BOTH
`wall_hidden_at` and `wall_hidden_by_guest_id`. A guest took her own photograph
off the wall, the couple pressed un-hide, and it went back up in front of the
room — **and the column recording that SHE was the one who removed it was
erased**, so nothing afterwards could tell her removal from a moderator's. The
second half is the worse half: it destroyed the evidence of the first.

⚖ Owner ruling 2026-09-14, confirmed 2026-09-16 — asked whether the couple may
put it back, he answered "correct": they may not.

- `supabase/migrations/20271231847206_a_guests_own_removal_is_final.sql` —
  `wall_unhide` now refuses when `wall_hidden_by_guest_id` is set. Checked
  AFTER authorisation, so the message is about the photograph and not about
  their access. `is_admin()` still passes, deliberately, for the NPC/abuse
  path; narrowing that is a separate ruling and is not smuggled in here.
- The guest's own path (`putMyPhotoBackOnTheWall`) is untouched. "Final" means
  final against OTHERS, never against her.
- `apps/web/tests/db/a-guests-own-removal-is-final.db.test.ts` — pins the
  refusal AND pins that a moderator-hidden photograph still un-hides. Proven by
  two sabotages against a green control: deleting the refusal branch reds test 1
  only; widening it to refuse everything reds test 2 only. Without the second
  property, "refuse everything" would satisfy the first and quietly take a real
  power away from the couple.

SPEC IMPACT: None — the ruling is already recorded in `DECISION_LOG.md`.
