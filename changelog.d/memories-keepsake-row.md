## 2026-10-31 · feat(memories): the keepsake row (Magazine · Recap · Flash · Thank You) and the + Add cell

Owner 2026-10-31, on Memories — *"the Photo Magazine, Flash Life, and Thank You. must be added as a row of buttons? and
maybe a cell also that allows them to upload a photo in trade of a papic credit?"* → "Build both". Hosts only.

- **The keepsake row**, directly under the Memories pinned row: four equal buttons, icon + one word. Each opens its
  SHIPPED card, unchanged, in the house sheet (`Sheet` / `OverlayBackdrop`): `MagazineCard`, `RecapCard`,
  `LifeFlashCard`, and the Thank-You Video door (`ServiceParts service="papic"`), which left the ⚙ — ONE home now.
  The bottom "Made from your memories" stack is gone; every card and its gating moved to the row. A card with nothing
  to offer YET is a dimmed door with its reason in the ⓘ; a card whose own rule says it must say nothing (Life-Flash
  flag off / not the couple; Thank You not offered here) draws no door. Which doors and why:
  `apps/web/lib/memories-keepsakes.ts`. Each card's reads were split out (`readMagazineCard`, `readLifeFlashCard`,
  `readServicePart`; Recap already had `loadRecapCoupleSummary`) so the button and the card answer from ONE read.
- **The + Add cell**: the first tile of the grid (All and Your uploads), the size of a photo — "+ Add photo" and one
  line priced by `papicCaptureCost('photo', null, 'upload')` (the presign gate's own function), the rest in the ⓘ. It
  opens the SAME sheet as the thumb row's + Add photos through the SAME handler (`openAdding`) — the same
  `AddToLibrary`, pot and Add more, the same turn-on choice when uploads are off, the same "other host's" line. No
  second uploader; the thumb-row button stays.
- Guard: `apps/web/app/dashboard/[eventId]/memories/the-keepsakes-are-a-row.test.ts`.

SPEC IMPACT: DECISION_LOG row "MEMORIES GETS THE KEEPSAKE ROW AND THE + ADD CELL" (supersedes, for hosts, the 2026-10-23
"one upload door, in the thumb row": the cell is a second door to the SAME uploader).
