## 2026-11-14 · feat(gifts): G2 — the tap-to-open gift moment, one claim that never counts twice

The approved gift design's G2 (corpus DECISION_LOG 2026-11-14: "THE GIFT MOMENT — A POPUP, TAP TO OPEN" · "ONE PIECE,
USED THREE WAYS" · "PRESSING REDEEM IS THE CLAIM — AND IT CAN NEVER COUNT TWICE" · "GIFT DESIGN APPROVED — WITH FABLE'S
EIGHT PICKS"; drawing artifact QSMD9BaefarMRNQAnMFiND §6).

- **One piece — `app/_components/gift-moment/gift-moment.tsx`** (props documented in its docblock, so G3 reuses it for
  Setnayan → shop gifts): THE one backdrop (blurred + darkened), a wrapped gift drawn in code with the giver's logo on
  the wax seal (two initials when none, Setnayan's mark for Setnayan), tap → shake → burst + gold flash + confetti → the
  opened box → the words rise → "Already in your event's Papic pool" → **Redeem**. Reduce motion fades. No video. Every
  length and curve is a motion token (`gift-moment.module.css`); the press uses the shipped `StdTouchGlow`. Loaded
  lazily (`next/dynamic`) only when a moment is about to show.
- **Uses:** (a) a couple's Home — a supplier's gift, each HOST (couple member) once, guests never; two shops play back
  to back, "1 of 2"; (b) supplier Today — a badge reward: the previous badge → the new one, plus the reward line,
  asked after `badge-earned-line.tsx`'s facts read (the door that pays the reward).
- **The claim:** migration `gift_moment_claims` — `gift_moment_claims` (UNIQUE `gift_moment_claims_once` on
  (source, ref_id)) and `gift_moment_claim()`: ONE `INSERT … ON CONFLICT DO NOTHING`, so a double tap, a retry, two tabs,
  two phones or the other host all land on the same claim. The button goes "Claiming…" and cannot be pressed again;
  no answer → "No connection — your gift is safe" + Try again (re-sends the same claim); already claimed → "✓ Claimed",
  no button. A claim grants nothing — the gift already landed. DB test `a-gift-is-claimed-once.db.test.ts`.
- **Later:** an unclaimed gift waits as ONE notice line, "🎁 A gift from <giver> is waiting · Open", with no close
  word, at the page's top (Today's `earned` slot; the event pages' top slot on Home) AND in the bell (new
  `bell` flag on a notice). Open brings the popup back.
- **One door, no new server action** (the budget is at its ceiling): `GET/POST /api/unwrap`.

SPEC IMPACT: None — builds the 2026-11-14 approved design as ruled; no ruling changed.
