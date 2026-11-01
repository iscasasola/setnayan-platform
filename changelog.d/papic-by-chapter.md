## 2026-11-01 · feat(papic): Papic shoots into a chapter — the Home card names it, both cameras tag it, its window and people enforced

Owner 1 Nov (DECISION_LOG "PAPIC BY CHAPTER MOVES UP" · "THE PAPIC CARD ON HOME SHOOTS INTO A CHAPTER" · "A CHAPTER'S
PHOTOS: WHO + WHEN"): *"when can i do a chapter so we can document our meetings? and be able to use papic?"*

- **Migration `20271300249267_papic_shoots_into_a_chapter`**: `papic_chapter_windows` (Start now · the card's pick, one per
  event) and `papic_chapter_captures` (a guest capture or seat photo → a chapter; more than one chapter allowed, the
  Memories seam). The window is the chapter's own start → end (end of its day when it has none); who may shoot is its
  own `photo_who` (Step 2) — reused, never copied. `papic_chapter_capture_refusal` is the one answer; a BEFORE trigger
  re-asks it for every captured link. RLS at create: the couple writes windows; links are read-only to the API.
- **Home › Papic card**: one added row under the event-wide counts — "Shooting into [chapter ▾]" (one PickMenu), its
  window with Start now, and "This chapter: N photos". Counts and Add more unchanged.
- **Cameras** (`papic-guest-capture.tsx`, `papic-seat-capture.tsx`): name the chapter and tag every shot with it; the
  guest route and `recordSeatCapture` ask the database before a credit moves. A meeting before the day turns the guest
  camera on for its people. A refused chapter never loses a shot when the camera was open anyway (event-wide, Unsorted).
- Prices, credits and ceilings untouched; no email.
- Guards: `tests/db/papic-shoots-into-a-chapter.db.test.ts`, `lib/papic-chapter.test.ts`.
- Seams left: Memories by chapter, server photo-URL membership check, moment-delete count, video trim (Step 7); the
  Event Hub's inline camera and the supplier camera lane do not tag yet; seat shots queued offline land event-wide.

SPEC IMPACT: None — builds the 1 Nov rulings as written. Controller's readings to confirm: "Only people tagged" for
shooting = named one by one; a chapter with no end closes at the end of its day; a chapter's people are its moments'
tasks until the chapter-level Who is built.
