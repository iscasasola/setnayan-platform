## 2026-11-19 · feat(motion): the motion standard, Phase 6 (a) + (c) — seven shared moments, built once; old aliases and dead keyframes retired

Owner, 19 Nov 2026: *"animations build the rest"* (18 Nov: *"Add all 10"*, *"ONE MOTION STANDARD"*). Chat send and the
six signature moments are NOT in this change (other builders).

**(a) Seven shared motions — each ONE part, adopted by the shipped call sites**

| Motion (§ 4) | The shared part | Adopted by |
|---|---|---|
| Celebrate #23 | `app/_components/celebrate.tsx` + `lib/moment-once.ts` (`playsOnce` — the once-gate; `tie` and the other signature moments have their key in it) | the paid page `/pay/[reference]` (payment received) · `badge-earned-line.tsx` (badge earned) · the spotlight tour's end (its own 70-piece confetti is gone) |
| Long press #24 | the ONE shared hold (`--sn-m-hold` / `HOLD_MS`) + Lift. The hold-menu part (`long-press.tsx`) was built, then REMOVED on 19 Nov because no screen mounted it (ugat both-ends); it returns with the first screen that opens a menu on a hold | the ONE hold (`HOLD_MS` 350): guests' role drag, the seat list + tray (was 300), the shortlist rearrange (was 450), the RSVP line |
| Lift #15 | `lib/lift.ts` + `.sn-m-lift` | guests' role drag · Seats › List · the seat tray (each lost its own `scale(1.02)` + shadow) |
| Upload #25 | `app/_components/upload-ring.tsx` | `file-upload.tsx` (row circle, thumb, gallery tile, list row — the pie, the spinner and the width bar are gone) · Studio prints · the Papic chip's ✓ |
| Coach marks #27 | `app/_components/spotlight-tour.tsx` | the ring, the hand and the progress line move by `translate` / `scaleX` in Move on Settle (was `transition: all .75s`, left / top / width) |
| Offline bar #28 | `app/_components/offline-bar.tsx` (mounted after the page by `motion-mounts.tsx` from `providers.tsx`) | every screen |
| Glide #12 | `.sn-glide-x` / `.sn-glide-y` + `app/_components/glide-mount.tsx` + `lib/glide.ts` | eight card rails; the picked shell's scroller says `contain`, not `none` |

Tokens added: `HOLD_MS` 350 / `--sn-m-hold`, `CELEBRATE_MS` 900 / `--sn-m-celebrate`.

**(c) Cleanup**

- Retired, nothing reads them: the 13 Nov aliases `--sn-m-ease-emph`, `--sn-m-ease-emph-rev`, `--sn-m-press-in`,
  `--sn-m-grow-press`, `--sn-m-grow-shape`, `--sn-dur-micro`; `EASE_EMPHASIZED`, `EASE_EMPHASIZED_REVERSED`, `EASE_SPRING`.
- Deleted, nothing read them: `@keyframes` `sn-scale-in` (+ `.sn-modal`'s animation), `sn-grow` (+ `.sn-bar > i`),
  `gl-adding` (+ `.gl-adding`), `sn-pop-in` (+ class), `sn-chip-pop` (+ class), `sn-grow-y`, `sn-marquee`, `fc-bump`,
  `mt-framein`, the tour's `sn-spot-fall`.
- Retimed onto the tokens (still read, so kept): `sn-pick-bounce`, `gl-sheetup`, `sn-canvas-sheet-up`,
  `sn-addman-sheet`, `sn-lens-in`, `sn-bloom`, `perf-fade-rise`, `home-up`, `home-catpop`.
- `scripts/motion-raw.baseline.json`: 1294 raw timings in 170 files → 1254 in 169 (regenerated, never hand-edited).
- NOT retired — still read: `--sn-ease` · `--sn-ease-out` · `--sn-dur-control` · `--sn-dur-elem` · `--sn-dur-enter` ·
  `--sn-pill-dur` · `--sn-pill-spring` · `--sn-dur-rise` · `--sn-ease-rise` · `--sn-scrim-fade` (re-measure:
  `grep -rIoE -- "--sn-(ease|dur|pill)[a-z-]*" apps/web/app apps/web/components apps/web/lib | sort | uniq -c`).

**Guards.** New: `lib/the-moments-move-by-the-standard.test.ts` (one test per motion + the house rules). Re-anchored,
not loosened: `a-photo-on-its-way-is-a-pie` (the pie is the one ring), `the-motion-standard-tokens` (the aliases are
GONE), `the-motion-table-is-one`, `the-rise-is-0-7s`, `the-press-feels-the-same-everywhere`, `the-form-row`,
`the-top-scrolls-up-and-locks`, `the-seat-plan-drags-on-a-phone`, `the-rsvp-stage-moves-a-line`,
`the-picked-client-opens-over-the-list`.

Sabotage — each seen RED once (19 Nov 2026), then restored:

| # | Sabotage | Test that went red |
|---|---|---|
| 0 | `--sn-m-hold: 350ms` → `400ms` | 0 · house rules + tokens |
| 1 | `if (playsOnce(` → `if (true \|\| playsOnce(` in celebrate.tsx | 1 · Celebrate |
| 2 | `SEAT_HOLD_MS = HOLD_MS` → `300` | 2 · Long press |
| 3 | `ghostAt(r.left, r.top)` → `… + ' scale(1.02)'` in guest-role-drag.tsx | 3 · Lift |
| 4 | `transition: rotate 1s` on the ring's half | 4 · Upload (and 0) |
| 5 | the tour ring's `transition:translate` → `transition:all` | 5 · Coach marks |
| 6 | the offline bar starts from `navigator.onLine` | 6 · Offline bar |
| 7 | `overscroll-contain` → `overscroll-none` on the picked shell | 7 · Glide |

SPEC IMPACT: `MOTION_STANDARD_2026-11-18.md` § 11 Phase 6 — (a) Celebrate · Long press · Lift · Upload · Coach marks ·
Offline bar · Glide and (c) cleanup are BUILT (Chat send and the six signature moments are separate builds); § 7's 🆕
rows now have names (`celebrate.tsx`, `lib/lift.ts`, `upload-ring.tsx`, `offline-bar.tsx`,
`glide-mount.tsx`). Not applied to the corpus by this change — for the controller. Owner calls surfaced: the upload
ring is gold with the figure on it (8 Oct ruled an accent pie); the No. 1 plaque's confetti, the gift moment's and the
supplier calendar's are NOT replaced by Celebrate; the long-press dim is the house scrim, not the drawing's lighter one.
