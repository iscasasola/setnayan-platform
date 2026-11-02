## 2026-10-27 · feat(guests): the row reply pills are one family — icon + its own colour; To invite is an outline; an unnamed +1 says whose invitation it rides

Owner (DECISION_LOG 2026-10-27 "THE ROW REPLY PILLS ARE ONE FAMILY", option A of `prototypes/guests_reply_pills_2026-10-27/`):
*"The attending. Not attending. No reply and no invite. Eeds to be presented better."* → *"Okay let us do A"*.

- `PILL` in `guests-screen.tsx` now carries an icon per state: ✓ Attending (green) · ✕ Not coming (danger red — it was the
  grey of No reply) · ? Maybe (amber) · clock No reply (grey) · send To invite (accent OUTLINE — it was the avatars' gold
  fill and melted into them). Colours are the carousel card ②'s dot colours, so card and rows agree.
- An unnamed +1 seat shows "On Sofia's invitation" instead of its own To invite pill (`PlusOneWords.host`, the guest's
  first name). The To invite COUNT rule (`isToInvite`) is unchanged.

Guard: `the-reply-pills-are-one-family.test.ts` (4 sabotages, each red). +0 server actions, no migration.

SPEC IMPACT: None — builds the approved 2026-10-27 row.
