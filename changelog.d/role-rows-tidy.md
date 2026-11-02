## 2026-10-22 · feat(attire): the dress code's role rows are one shape — a time chip, a column per figure, note + photos folded on a phone

Owner, 22 Oct, on Maker › Mood Board & Dress Code › Attire on a desk: *"seems like we can make the arrangement and how
to access parts easier to manage and look better than how it looks now"* — and "Yes to all" to prototype
`dress_code_role_rows_tidy_2026-10-22.html`. Same controls, each beside what it belongs to; nothing new is stored.

- **The time is the header chip** (`mood-board-studio.tsx`): the role's name · its people · ONE chip — "Call time 1:00 PM",
  "Set a call time", the Guests' "Arrives 2:30 PM · from Ceremony". A tap opens the SAME field and Clear (`CallTimeRow`) in
  a sheet with ✓ Done (a refused time is said under the field and the sheet stays open). The chip and the sheet read one
  `timeOf(row)`. Waiting (grey, still a button) until a Wear is picked, with the shipped "Pick what they wear first".
- **Every column is figure → its labelled dots → its Wear ▾**, the groom's one figure included, at a pair's column width,
  so the groom and VIP line up; a pair's two Wear ▾ sit level.
- **On a phone, the note and the photos fold behind one quiet "more" row** (`role-more-row.tsx`): ✎ the note's words ·
  the first photos and how many ›. It opens the row's sheet — the note (saved when put away, as the time wheel is), the
  photos with ＋ and Search ideas, ✓ Done — in the thumb zone. A supplier's photo still waiting stays on the page, where
  the top notice jumps to it.
- **On a desk, two columns inside the row**: the figures left; the note and the photos right, each button beside its own
  words, the key word hanging so a wrapped button lines up under the words. The Studio body is ~636 px at a 1280 px
  window, so the right column narrows to fit (`minmax(340px,1fr) · ≤ 430px`) and the Guests' men/women strips sit side by
  side only where their column is ≥ 640 px (a container query).
- Guards: NEW `lib/role-rows-are-one-shape.test.ts` (header chip ≥ 44 px and alone in the header · every column's direct
  parts figure → dots → Wear ▾ and a lone figure at a pair's width · each control hidden at one width has its twin shown at
  that width, and the sheets hold the same note and photos line; sabotaged ×5, each red). RE-AIMED to the chip:
  `each-role-has-its-call-time.test.ts` § 3 (+ § 3b the sheet's field) and `guests-have-one-arrival-time.test.ts` § 2b · 6b.

SPEC IMPACT: DECISION_LOG.md row 2026-10-22 "DRESS CODE ROLE ROWS — ONE SHAPE, SAME CONTROLS" (corpus commit b9a7f4a0) —
records the owner's approval of the prototype and the desk-width build note.
