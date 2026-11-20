## 2026-11-20 · feat(guests): the Guests redesign, builder A — the list, the thumb row's drag-to-add, Seats › List as table cards

Built from the approved drawing `prototypes/guests_redesign_2026-11-20/` (artifact 8rQC8Ug4UCvu3YVvHQR99T), DECISION_LOG
rows 20 Nov "EVENT › GUESTS REDESIGN DRAWING — THE FIVE PICKS APPROVED", "GUESTS › SEATS, ROUND TWO" and "GUESTS
REDESIGN: BUILD IT" (owner: *"Yes, build it"*). Extends the shipped screen; no second page, no new server action, no
new read.

- **Guests › List — one summary in words.** "34 guests ⓘ · Send 30 invites", one thin bar (coming · no reply · can't
  come), "32 coming · 0 can't come · 2 no reply" — each word the same door to exactly those guests (`pickReply`). It
  replaces the summary carousel and the ✓ ✕ ? icons in the List's top row (the Map keeps them). "+1s" and "asking to
  join" are one extra line, only when there are any.
- **Sections start open; headings are text only** (the grey icon chip per heading is gone). "Fold all" is the last line
  of Show and sort (the ⇕ round left the thumb row).
- **Rows:** no Share button (pick 3 — Send invite stays on the guest card, "Send N invites" in the summary; the page no
  longer ships every guest's token to the list). Coming is a quiet green tick at the row's end (pick 4); only No reply ·
  Can't come · Maybe · To invite keep a pill, and "No seat yet" is amber in the second line. The second line is plain:
  role (when the heading does not already say it) · table. The side is a small dot on the photo. Tap opens the card;
  the swipe left says "Remove".
- **The thumb row (pick 1–2):** drag the search box right to add, back left (or ✕) to search again; the shipped tap 🔍 → ＋
  stays as the second way. While adding, the box is ringed in the add colour and ends in "Guest ▾" (From your people ·
  Import a file), with the other ways and "what Enter will add" above it; while searching with words, one line says
  "Drag the box right to add a guest". Shared in `components/thumb-row.tsx` + `components/search-add.tsx` as an opt-in
  (`field.dragAdd`) — no other screen changes.
- **Seats › List (pick 5):** every table is a card (name · VIP · "7 of 10" · faces · dotted empty chairs, "+N empty"),
  "To seat" first while anyone is unseated, counts in words ("34 seated · 0 to seat · 9 tables · 43 empty chairs") and
  the top row's icon counts step aside on this view. Tap a table → it rises full screen: its people (Move · swipe off the
  seat), one "N empty seats · Add a guest" row whose list STAYS OPEN so names are tapped one after another (round two,
  pick 5), and "This table" (the editor's own Shape ▾ · Seats − N + · VIP) with Rename and Done at the bottom. Every
  write is the seat plan's own handler (`dropSeat` · `unseat` · `tapBlank`); the floor editor is untouched.

Not in this PR (see the PR's STATUS for the full parity list): the full-screen guest card (§3), March (§7), the view
menu (§8), Seats › 2D / 3D and the floor (builder B).

SPEC IMPACT: None — builds an approved drawing; no ruling changed.
