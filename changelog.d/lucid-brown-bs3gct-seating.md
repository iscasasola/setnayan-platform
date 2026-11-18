## 2026-11-17 · fix(seating): the Reception Designer says when it could not read which zones are agreed

From the couple-dashboard audit: `seating/lab/page.tsx` read `moodboard_part_finalizations` with `?? []` and never looked at the error. A refused read meant every zone a supplier had **agreed** (frozen) was drawn as freely editable, with no word that the agreements were never read. The page now logs the refusal and shows its own `ReadRefusedNotice` (partial) above the room: *"Some of this page is missing — we couldn't load which zones your suppliers have already agreed on."* The room itself still loads.

SPEC IMPACT: None
