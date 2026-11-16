## 2026-11-15 · feat(award): the shared award UI kit — full-screen badge, reward ticket, story video, seal plaque (slice K of 4)

Controller build map `BADGES-BUILD-MAP-2026-11-15.md`, "Shared UI kit" row. A faithful port of the owner-approved prototype `prototypes/supplier_badges_2026-11-15/badge-milestones_v35.html`, its plaque and No. 1 reveal carried to `badge-milestones_v53.html`, the owner-approved Fable prototype (grand plaque v39, red velvet v41, sparkle v42, iPhone-safe lights v43/v44, gold vs No. 1 plaques v45, the No. 1 reveal v46–v48, and v49: the valance as cloth on a rail of coupled springs, tassels, a swinging fringe, house lights fading up, and in the app an unbroken exit from the curtains into the plaque).

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
- **v49 No. 1 exit:** after the 15 s reveal, the same curtains are hauled off the rail ends and the valance is hoisted away, on a layer over the plaque as it rises. The staged medal flies into its slot, measured at the plaque's rest position. The plaque's confetti adopts the reveal's live pieces and does not restart. Tap to skip jumps to 15 s and plays the same exit. The shared video dips to dark over its last 0.5 s so it loops. For every seal, the fly-off start is now measured inside the letter-box.
- **v50 speed (owner: "Super laggy"):** the seal is rasterised once, and the glowing texts (shop name, hallmark, the No. 1 teaser) are drawn once into their own canvases, so no frame re-draws an SVG or a blur. The curtain's colours are numbers, not strings. The valance draws one strip per two columns, and each cloth's shade is filled once over its outline. In the app the entrance draws at the size the screen shows (`scale`, DPR capped at 1.5); the story video stays at 1080×1920. Caches are warmed before the first frame.
- **v51 the exit on a phone (owner: it went "straight to the logo placing the plaque"):** the stage still is built in the reveal's last 1.2 s (`rig.prep`), both clocks advance at most 50 ms a frame, and the stage holds for three painted frames before the plaque rises and the medal flies. The confetti now meets the plaque: a piece crossing the top edge of the card or the plate bounces, rests a while, or falls past (about a third each).
- **v52 the tap answers at once (owner: laggy on his laptop):** the dark intro opens before the rig is built and paints for two frames; the canvas and "Tap to continue" go in once it is ready. The warm-up builds the caches without running the cloth (`WARM`), then settles it once: the build took about a third of the time in local runs.
- **v53 one scene (owner, on the phone: "two different scenes"):** the No. 1 stage no longer fades into the blurred app page. Its bare set (glow, rays, sparkles; no medal, no words) stays on a layer under the plaque for as long as the plaque is open, on a black backdrop; only the words fade. The curtains leave on the layer above. The plaque stays unseen during the 3-frame hold, and the share button rises after it.
- **`no1Seal`**: the No. 1 seal art. It is an option only and is not wired into any public or dashboard surface.

Render and source tests in `award-kit.test.ts` (17, including the set layer under the No. 1 plaque, a per-frame cost guard and the confetti ledges). Screenshots at 375×640, 390×844, 768×1024 and 1440×900 are in `build-sessions/shots-award-ui-kit/`. No route was added and the bundle budget was not raised.

SPEC IMPACT: None. This ports the approved prototype; nothing is wired into a live page yet (slices A, B and D mount it).

**Mounted (2026-11-15).** The kit's four views now mount from a dev-only lab, `/dev/award-lab` (`page.lab.tsx`; production 404s it, like every `/dev/*-lab`). It draws the tickets in all three states, the full-screen badge, the gold seal plaque and "Share to story" on sample data. This is the harness the screenshots came from, and it clears `ugat-both-ends` ("component-no-mount") without adding to that baseline. The lab takes one reasoned line in `lib/ugat/baselines/no-door.baseline.txt`, the same line every one of the other `/dev/*-lab` pages carries (reached by typing its address). It does not use `no1Seal`.

## 2026-11-15 · feat(award): the award kit brought up to v86 (BADGE BUILD · J1)

A port of `prototypes/supplier_badges_2026-11-15/badge-milestones_v86.html` and the owner's 15 Nov rulings. Still client-only, still opened only on a tap; zero new server actions and zero new routes; the art is loaded lazily.

- **Reward ticket:** no rainbow foil. It is never a button and has no "tap to claim": rewards are claimed automatically. Its states are locked · "✓ New · in your gifts" · "✓ In your gifts".
- **One ✕ on every full screen** (`AwardClose`): 44 px, round, top left, dark glass with an ivory ring.
- **Days line:** "You achieved this after N days" appears on tiered badges only.
- **Setnayan Verified:** its own navy full screen, with no plaque and no days line.
- **The locked look** (`LockedTile`): the shop's own badge page shows a grey version of each badge's art under a lock, with what it takes to earn it. Couples never see it.
- **Seals:** the #1 RANK medal (Cinzel outlines, 34 diamonds) on a gold-ray stage with no glow. Confetti is for No. 1 only and ends when the seal lands. The velvet is matte, and the landing is smooth.
- **Five tap shows, with final counts** (`tap-shows.ts`, loaded lazily):
  - Gifts given and Invites: 5–35.
  - Trusted by: 1–7 shield pulses.
  - Five-star reviews: the five row stars.
  - Completed bookings: the calendar steps.
- **Service-card badges:**
  - The congratulations screen (`CardBadgeCongrats`).
  - The rules pop-up shell (`CardBadgeRules`), which J3 fills.
- **The ticket frame metal matches the tier** (owner ruling 15 Nov, item 7): Bronze · Silver · Gold · Platinum · Diamond · Ruby · Black Diamond, chosen by the ticket's `tier`.
- **Off by default (props):** the shop-logo watermark behind No. 1, and No. 1's gift.
- **Guards** (`award-kit.test.ts`, `card-badge.test.ts`, `tap-shows.test.ts`):
  - Confetti appears only on No. 1, and the days line only on tiered badges.
  - The art loads lazily, and the tickets have no rainbow.

SPEC IMPACT: None. The kit follows v86 and the DECISION_LOG rulings of 2026-11-15; no ruling changes.
