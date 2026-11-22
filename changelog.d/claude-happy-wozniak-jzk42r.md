## 2026-11-22 · feat(guests): drawing v4 parity — March adds a walk from the box, Preview keeps its word, "N found", the card says Coming and names the seat

A parity pass of the shipped Guests screen against the approved drawing
`prototypes/guests_redesign_2026-11-20/guests_redesign_2026-11-20_fable.html` (DECISION_LOG 20 Nov "EVENT › GUESTS
REDESIGN DRAWING", "GUESTS › SEATS, ROUND TWO", "GUESTS REDESIGN: BUILD IT"). The 20 Nov builds (#8064 and the card /
March / view-menu build) already carry most of it; this is only what was still different.

- **§ 7 March — Preview keeps its word.** The drawing's "▷ Preview" shipped as a bare ▷ round: the button was `filled`
  (a look the fit pass may shrink to its icon) and the top row's seat stripped every button's word. It is the view's
  `main` verb now, and the seat exempts `data-main`; Seats' Edit · ⋯ rounds are unchanged.
- **§ 2 + § 7 March — the orange ＋ ▾ is gone; the box drags right to add a walk.** "Search a name", drag right →
  "Walk ▾" at the box's right end holds what the ＋ ▾ held (New group, then the "Not walking" names). Typed words find
  the Not walking names; Enter or ＋ adds the first through the SAME move as the tray drag (`planMove` from 'out'),
  Undo and all; a name that is not out is told so ("Nobody called “…” is out of the march"). One line above the box
  says "Drag the box right to add a walk" while searching, or what Enter will add while adding. Every way in is kept:
  the tray drag, the group toolbar's ＋ Walk and ＋ Group, and the shipped tap 🔍 → ＋.
- **`AddKindPick`** (`guests/_components/add-kind-pick.tsx`) is the one "Guest ▾ / Walk ▾" piece; the List's Guest ▾
  now uses it too (no behaviour change there).
- **§ 2 List — "N found".** Searching says how many guests it found, in the headings' letters, counted off the rows it
  draws (`visible`). The "Drag the box right…" line sits on the thumb row's glass, so rows never show through it.
- **§ 3 The guest card — Coming, and the chair.** The card speaks the List's words (`RSVP_LIST_WORDS`: "✓ Coming",
  Reply "Coming", "Can’t come") so a row and the card it opens agree. Seat reads "Entourage · Seat 2"
  (`seat_number` is now read; `seatWords` in `lib/table-words.ts`, counted from 0 like Seats › List).
- **Honest read (fix).** A refused seat read used to fall through to "Not seated" — telling the couple a seated guest
  had no seat. It now says "Couldn’t read their seat" (`seatUnread`). Lab: `/dev/guests-lab?part=card&frame=panel&seatrow=fail`.

Guards: new `guests/_components/drawing-v4-delta-holds.test.ts` (5 tests, each sabotage-checked red);
`guests/the-march-is-a-numbered-line.test.ts` amended (Preview is `main`, dated note). No migration, no new server
action, no new table.

SPEC IMPACT: None — builds the approved drawing; no ruling changed.
