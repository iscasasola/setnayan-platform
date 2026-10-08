## 2026-10-08 · feat(egifts): the guest's wish list and send sheet (wish list 3/5)

Stacked on wish list 2/5 (`rd/wish-list-studio`), which is stacked on 1/5 (the
ONE migration). This PR adds no migration and no server action.

Owner 2026-10-08, "ok wish list" · "per item" (design
`EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 "Guest" + § 6 E-PR3; prototype
`egifts_wish_list_2026-10-08_fable.html` frames 12–17 · 21–24).

- **The E-Gifts page (`/[slug]/pabuya`) draws the wish list ABOVE the ways to
  give** — a wish is what you give toward, the ways are how. Each wish: its
  photo (or one gift glyph) · name · "₱4,000 of ₱4,500 sent" with a meter, or
  its price alone, or "Any amount". A got wish is dashed, struck through, "Got
  it ✓ · thank you", at the end; tapping it says "Already got — thank you!".
  Under the list: "Tap a wish to send toward it — or give any amount below."
  With a list above them, the ways to give gain their own eyebrow; a page with
  no wishes is unchanged.
- **It wears the E-Gifts look already picked in Stages › Style — no second
  picker:** The door → Rows · Side rule → Rows with the rule · Centred → Tiles
  · Between rules → Ruled.
- **Tap a wish → "Send for the Air fryer"**: "₱500 more reaches ₱4,500 · any
  amount helps — it goes straight to Maria & Jose's own account." (with the
  couple's note), then the couple's own ways to give exactly as the page draws
  them, and ✕ Close.
- **The Welcome gift door gains one line** while a wish is open: "Wish list · 4
  things they'd love". Not on a solemn page (no quiet sentence has been
  written for it), and never without a door.

What a guest can and cannot see:

- **One figure per wish** — what guests say they sent. The guest read
  (`readGuestWishList`, service role behind the page's own published gate)
  takes the sum's three columns and the wish's guest columns; no giver's name,
  words or screenshot is read on this path at all. A wish is named by its
  public id (`S89H-…`), never its row id.
- **The send sheet withholds payment identifiers exactly as the page does** —
  it is handed the page's own cards (already withheld from a reader the event
  does not recognise) as a ready-drawn node, and says so when something is
  withheld. `PabuyaCardList` gains an optional `idScope` so the second drawing
  has its own element ids.
- **One rule decides whether the list is shown** — the Studio's own
  `wishListShownToGuests` (gifts accepted · a way to give switched on · at
  least one wish). With no way to give the list is kept, not drawn. A read
  that fails draws no list, never wishes with nothing sent beside them.
- **"Sent" is the only money word** — `the-guest-text-is-honest` now reads the
  guest's wish surfaces too.

Not in this PR (said, not dropped): **"✓ I sent it"** and the sentence that
promises it ("Once you've sent it, show Maria & Jose your screenshot…"), "Sent a
gift? Show the couple ›" under the ways, and the guest's own "You sent ₱500 ✓"
are wish list 4/5 — the sheet takes them through one prop (`sent`). A wish's
shop link is not shown to guests (the drawing shows none).

Tests: `lib/wish-list-guest.test.ts` (11) ·
`lib/the-guest-wish-list-follows-the-drawing.test.ts` (8 — the real list and
door rendered on the prototype's seed, the page's wiring, the guest read) ·
`an-account-number-is-not-public` +1 · `the-guest-text-is-honest` extended.
Lab: `/dev/maker-lab/guest?wish=five|got|long|noprice|door&look=rows|side|tiles|ruled&known=0`.

SPEC IMPACT: None. Build status in the corpus:
`EGIFTS_WISH_LIST_BUILD_STATUS_2026-10-08.md`.
