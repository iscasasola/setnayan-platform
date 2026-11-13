## 2026-11-12 · feat(vendor-plans): the limits sheet — what does not fit a lower plan, with a Fix for each (ruling 5683)

- **A lower plan's row** on the Plan sheet now lists "What doesn't fit <plan>", limit by limit, each with a Fix that
  opens the page that fixes it: services (the create gate's fit rule — what doesn't fit goes on hold when the plan
  starts, the supplier picks which stay on), bookings a day per card, team seats and branches (kept; can't add more),
  reach. Every number through `limitOf` / `capsOf` (`TIER_CAPS`); branches 0 on Free and Verified.
- **"Switch to <plan>"** first rises the limits sheet (`RiseScreen`, sibling of `lock/limit-sheet.tsx`) with the shipped
  Pay form in its thumb.
- **The storage floor** (`storageFloor`): a plan holding less than the shop stores blocks the switch until files are
  removed. No plan has a storage allowance in code yet (storage rows priced and inactive, migration
  20271308555594 §2b), so `storageAllowanceBytes` returns null and the row is not drawn — no guessed number.
- **The badge grace:** a verified shop moving down is told its Verified badge stays to its own day
  (`hasVerifiedBadge` / `badgeDeadline`; 30 March for the early shops).
- Files: `lib/downgrade-limits.ts` (+ test), `lib/downgrade-limits.server.ts`,
  `app/vendor-dashboard/subscription/_components/limits-sheet.tsx`; lab `?s=plan&who=studio&limits=1` (`&floor=1`).

SPEC IMPACT: None — implements ruling 5683. Open for the owner: the storage each plan holds (no figure is ruled).
