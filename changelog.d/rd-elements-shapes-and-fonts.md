## 2026-10-08 · feat(look): Elements › Buttons is the Reply button in three shapes — no "Default"; the colour is the palette's (amendment PR 5, step 1)

Owner, verbatim (2026-10-08): round 5 — *"do not need to show default button just show the 3
button styles"* · round 3 — *"button color will be taken from their 5 palette"* · round 2 —
*"Pick Button Shape (color is on the palette already so no need to add)"*. Contract:
`BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.B / § 2.E, prototype frame B05. Local commit.

- **Three cards, each the real button:** Square · Rounded · Pill — "Reply", at the guest
  button's own size, in the page's own button fill, its name under it. Shape ▾ (a dropdown
  with "Default") is gone. The picked one wears the accent ring and name and centres itself.
- **The theme's own corner is READ, never written** (`lib/hub-button-shapes.ts`): an event
  that never chose keeps its theme's corner; the row rings the one of the three that corner
  reads as (0 → Square · a pill → Pill · anything between → Rounded — so five themes ring
  Rounded, five ring Pill) and draws THAT card with the theme's real corner. A tap on the
  ringed card writes nothing; the page changes when another is tapped.
- **The colour is the palette's:** the cards are drawn with no colour of the row's own — the
  page's button fill (the couple's Accent, deepened until its label reads). A quiet "● Accent"
  says so. A Shape pick hands a colour stored before this (`site_button_color`) back to the
  palette (the note: "nulled on the couple's next Buttons write"); the stored FILL half of
  `site_button_style` is carried unchanged and still drawn (an outline stays an outline).
- No new storage, no migration: `site_button_style` keeps its vocabulary (`theme` is still a
  value a row may hold).

control → kind: the three → a Style-card strip whose picture is the real button (accent ring ·
accent name · centred). Requests: a pick = 1 draft write, held — unchanged; opening = 0.

Guards: `look-buttons-reach-every-button` (4) and (6) re-aimed, with the reason — (6) used to
hold "ONE dropdown, and a stored colour is still worn by the sample"; the owner's rounds 3 and
5 replace both. Now: the three cards rendered on every theme (order, words, one ring on the
theme's reading, the theme's real corner, the page's own fill), a stored colour makes no
difference, a stored fill is carried and drawn, a tap on the ringed card reaches no write.
`every-studio-colour-opens-the-one-picker`: its hand-kept list of files that paint a handed
colour gains three lines — this row's Accent dot, the Effects cards (Colour ▾'s dots and a
veil), and Background › Colour's two circles (L3's file; the list arrived with the new base
and was already red on it). 14 sabotages seen red.

Deviations, each with its reason:
1. **The guest page still honours a stored `site_button_color`** until that event's next
   Buttons pick. The note wants the page to stop reading it at deploy, after "the controller
   confirms the count" of events that hold one — a count I cannot take (no production reads).
   One line in `guestLookFrom` when that count is known.
2. **No way back to the theme's own corner from this row** once a shape is stored (there is no
   "Default" card by ruling) — Undo and Restore are the way back.
3. The three fit a 375-px row, so nothing peeks (the note drew four).
4. Event Details' one-line summary still says "Default" for an untouched event
   (`details/page.tsx`) — not changed here.
5. The row is one component, so the shipped Maker's Look and Event Details' Buttons row show
   the three cards too.

NOT SEEN in a browser at commit time.

SPEC IMPACT: None beyond the contract above.
