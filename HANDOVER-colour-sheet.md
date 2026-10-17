# HANDOVER — rd/colour-sheet-fits-one-screen (2026-10-17)

Owner: "Just have the Moodboard and Recently Used 5 colors" — the one colour sheet fits a 375×812 phone, no scroll.

Done (committed): sheet rewritten (`ColourPickerSheet` → `ColourPickerBody`), `lib/colour-picker-recent.ts`,
guards updated, e2e fit spec + renderer, maker-lab LastSeenScope.

Decisions taken (not in the record): "From your photos" also removed (owner: "Just have…"); `fromPhotos` prop kept
optional + ignored so mood-board-studio.tsx (#6602's file) is untouched; SwatchPopover's own search-by-name extra
left in place (guard F holds it) — it duplicates Custom's name search, follow-up.

Next: walk at 375 (before/after, attire Shirt + Style › Colour) — scripts in ~/Documents/Claude/Projects/colour-sheet-walk/;
CI green; shots → ~/Documents/Claude/Projects/shots-2026-10-17/colour-sheet/.
