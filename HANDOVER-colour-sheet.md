# HANDOVER — rd/colour-sheet-fits-one-screen (2026-10-17)

Owner: "Just have the Moodboard and Recently Used 5 colors" — the one colour sheet fits a 375×812 phone, no scroll.

Done (committed): sheet rewritten (`ColourPickerSheet` → `ColourPickerBody`), `lib/colour-picker-recent.ts`,
guards updated, e2e fit spec + renderer, maker-lab LastSeenScope.

Decisions taken (not in the record): "From your photos" also removed (owner: "Just have…"); `fromPhotos` prop kept
optional + ignored so mood-board-studio.tsx (#6602's file) is untouched; SwatchPopover's own search-by-name extra
left in place (guard F holds it) — it duplicates Custom's name search, follow-up.

Walked 2026-10-17 (/dev/maker-lab?studio=1, no-database env, Chromium 375×812): before, the attire sheet scrolled
(792 px of content in a 435 px box, Custom at y=1093); after, nothing scrolls, 5+5 shown, Custom at y=736–780.
Recently used proven live: six picks → newest five, the Mood Board pick left out, same row on the Style sheet.
Shots: ~/Documents/Claude/Projects/shots-2026-10-17/colour-sheet/ (+ /6615/). Walk scripts: ~/Documents/Claude/Projects/colour-sheet-walk/.
Sabotage: e2e 2/2 red, unit 5/5 red; clean green. Left: CI green.
