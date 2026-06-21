## 2026-06-22 · fix(nav): broken-out action moves INTO the bottom-nav row (right, isolated)

Owner feedback on the live redesign: the "+" action button was floating *above* the bottom nav; it should sit **in the same row, at the right, isolated** (the Shazam layout). Done:

- **`nav-fab.tsx`** — the FAB now sits in the bar row, vertically centered off the bar's `--sn-bottomnav-h` height, fixed at `right:14px`. On mount it sets `data-sn-fab` on `<html>` (cleared on unmount / in the couple "after" phase). Removed the old above-the-pill offset and the docked-SubNav hide (no longer needed — it's in the bar row, below the SubNav's band).
- **`globals.css`** — when `data-sn-fab` is present, the locked pill's right inset shrinks to `78px` (14px FAB inset + 56px circle + 8px gap), so the pill ends just before the circle. Scoped to the nav's existing `aria-label="Primary navigation"` marker, which out-specifies the Tailwind `right-[14px]` — **the locked `bottom-nav.tsx` is read, not edited** (`lint:botnav` ✓). No FAB on a doorway → no attr → the pill stays full-width.

So all three doorways now show the pill + an isolated Mulberry action circle on the same row (couple = Add guest, vendor = Check inquiries, admin = Payment requests).

Verified: `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm lint:botnav` ✓. Best confirmed on the Vercel preview on a phone.

SPEC IMPACT: Nav layout tweak — broken-out action repositioned into the bar row. No SKU/schema/pricing change.
