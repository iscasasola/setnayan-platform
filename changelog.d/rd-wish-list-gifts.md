## 2026-10-08 · feat(egifts): "Gifts sent to you" — the couple's list of gift records (wish list 5/5)

Owner 2026-10-08: "yes. it will accumulate all the gift and mark them one by
one" · "when amount is reached." Design `EGIFTS_WISH_LIST_2026-10-08_fable.md`
§ 2 "One gift open" · "Gifts sent to you" + § 6 E-PR5; prototype frames 05 · 07 ·
08. Stacked on #6444 → #6440 → #6435. **No migration · +0 server actions · +0
routes.**

- **The door:** the row under the wish list ("Gifts sent to you · ₱14,500 said
  sent · 5 gifts ›") opens every record — newest first, with what guests say
  they sent in all — as a screen of its own; ✓ Done returns. Removed records
  wait under "Removed" and count nowhere.
- **A gift, open** (from that list or from its wish): the screenshot, their
  words, **Amount they said** (kept when the field is left — no Save), **Counts
  toward** (one dropdown: every wish, then "Any gift"), 🗑 Remove in two taps,
  and for a removed one, Put it back. "A screenshot is what they sent you, not
  money in your account — check GCash or your bank."
- **Marked one by one:** correcting, moving or removing a record adds its
  wish's gifts up again, and Got it follows the sum ("when amount is reached") —
  the couple's own mark is never touched.
- The word is "sent" / "said sent" everywhere. Nothing says a gift arrived, and
  there is no refund language.

**Requests (owner rule 2026-10-08), counted on the real functions over the
replayed schema** (`tests/db/the-couple-marks-gifts-one-by-one.db.test.ts` test 10):
- Studio › E-Gifts' list read: **2** (one per table, side by side) — unchanged
  by this PR; **no screenshot is signed in it** (the first draft of this step
  signed one address per record on every Maker render).
- The screenshot: **1 read, only when ONE gift is opened** — a 10-minute signed
  address for a host, from this event's own private folder; reused for 8
  minutes, so reopening a gift asks nothing. A row of the list draws a mark,
  never a picture (there is no stored thumbnail to show without a request per row).
- Correct an amount / remove / put back: **1 write** for a gift toward no wish;
  **1 write + 2 reads together** toward a wish, **+1 write** only when its mark
  changes. Move: **2 reads together + 1 write + 2 reads together** (+ a mark
  per wish that changes). Each plus the door's sign-in check and, after the
  answer, one read of the event's address.
- **Whole-Maker server renders per gift action: 0.** The change is drawn first
  (`settleDrawn` mirrors the server's own rule), saved held, and a refusal puts
  back only that record. The door refreshes the guests' pages after its answer.

Files: `studio-wish-gifts.tsx` + `studio-wish-sheet.tsx` (new, lazy — they ride
the `maker-details` chunk) · `studio-wish-list.tsx` · `pabuya/gift-records.server.ts`
(new) · `pabuya/wish-items.server.ts` · `pabuya/actions.ts` (the one door) ·
`lib/wish-list.server.ts` (`readGiftShotUrl`) · `lib/wish-list-studio.ts` ·
`maker-details.tsx` (the gifts screen stands alone).

Guards: `lib/the-couples-gift-list-follows-the-drawing.test.ts` (11 tests) ·
`tests/db/the-couple-marks-gifts-one-by-one.db.test.ts` (10 tests, RLS on) ·
`the-generic-signer-is-public-only` (the private reader's new home) ·
`the-guest-text-is-honest` (three more gift surfaces) · the held-save guards.

SPEC IMPACT: None beyond the approved design. Deviations are listed in the PR
body and `EGIFTS_WISH_LIST_BUILD_STATUS_2026-10-08.md`.
