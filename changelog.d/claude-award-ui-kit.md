## 2026-11-15 · feat(award): the shared award UI kit — full-screen badge, reward ticket, story video, seal plaque (slice K of 4)

Controller build map `BADGES-BUILD-MAP-2026-11-15.md`, "Shared UI kit" row. A faithful port of the owner-approved prototype `prototypes/supplier_badges_2026-11-15/badge-milestones_v35.html`, its plaque and No. 1 reveal carried to `badge-milestones_v48.html` (grand plaque v39, red velvet v41, sparkle v42, iPhone-safe lights v43/v44, gold vs No. 1 plaques v45, the No. 1 reveal v46–v48).

New in `apps/web/app/_components/award/`, client-only (no fetch, no server write, zero server cost), each opened only on a tap:

- **`BadgeFullscreen`**: the badge flies out of the cell it was tapped from, then tilts and floats. It stacks badge → caption → glass "Share to story" → the SETNAYAN hallmark and never overlaps (`fit.ts` `badgeStack`). Tier names and paints are props.
- **`RewardTicket`**: the gift ticket in its locked, ready and claimed states, with the `tkSvg` art. Only "ready" is a button, and a second tap cannot claim twice.
- **`StoryVideo`**: a lazy door, so `story-video-impl.tsx` and `story-rig.ts` load only on tap in their own `award-story` chunk. It records a 1080×1920 story on the phone (mp4 avc1 → mp4 → webm → a still PNG) and lets the person save or share it. It takes `reveal` and `durationS`: 15 s for the No. 1 reveal, otherwise 10 s.
- **`SealPlaque`**:
  - The entrance (the story scene, then the seal flies to its mount), then the grand black-and-gold plaque.
  - `variant: 'gold' | 'no1'`. Only `no1` gets the diamonds, the velvet-curtain reveal (simulated cloth) and the endless black-and-gold confetti.
  - The plaque scales with a transform, never `zoom`. Its share button stays full size, 44 px tall, under it (owner, "Stay full size"); `plaqueLayout` reserves the button's room first.
  - Cinzel is loaded through the root layout's `next/font`.
- **`AWARD_COPY(year)` / `sealPlaqueCopy(kind, year)`** (`award-copy.ts`): the approved words for every seal (No. 1, Top 10 medal, Clients' Choice, Most In-Demand, Setnayan Verified, Verified Partner), ported verbatim from the prototype's `AWARD_TXT`: eyebrow, title, body, and the "How it is earned" lines with their met flags. The year is a parameter. The prototype's sample record numbers are left out; callers pass the shop's real record.
- **`no1Seal`**: the No. 1 seal art. It is an option only and is not wired into any public or dashboard surface.

Render and source tests in `award-kit.test.ts` (13). Screenshots at 375×640, 390×844, 768×1024 and 1440×900 are in `build-sessions/shots-award-ui-kit/`. No route was added and the bundle budget was not raised.

SPEC IMPACT: None. This ports the approved prototype; nothing is wired into a live page yet (slices A, B and D mount it).
