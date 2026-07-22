## 2026-07-22 · feat(papic-games): Phase 3b — guest Photo Challenge panel

The guest-facing capture-surface UI for Papic Games (spec §5#3). Wires the
Phase 3a anon RPCs onto the existing zero-account guest camera. Flag-gated
(`NEXT_PUBLIC_PAPIC_GAMES_V1`, default OFF) and self-hiding when the event has
no live challenges — nothing appears until the owner flips the flag.

- **`app/papic/guest/_components/papic-challenge-panel.tsx`** (new, client) — a
  collapsible "Photo Challenges · done/total" panel rendered on the dark capture
  stage. Lists the guest's live missions (not-done first), shows their own
  progress, and completes one by attaching the photo they just took. Carries the
  **§4 share consent** as an explicit, default-OFF toggle (RA 10173). Renders
  `null` when the flag is off or there are no missions.
- **`app/api/papic/guest-missions/route.ts`** (new, GET) — the guest's live
  mission list. Derives `guest_id` from the `setnayan_guest_session` cookie
  server-side (never trusts the client), idempotently ensures the free booth
  missions exist, then reads via `fetchGuestMissions`.
- **`app/api/papic/guest-complete-mission/route.ts`** (new, POST) — records a
  completion + consent via `completeMission`. `guest_id` is cookie-derived;
  consent opts in only on a literal `true`.
- **`lib/papic-missions.ts`** — pure `missionProgress` + `sortGuestMissions`
  helpers (5 tests total, all passing).
- **`papic-guest-capture.tsx`** — mounts `<PapicChallengePanel lastCaptureId />`
  after the shutter helper line (the panel self-gates).

Typecheck: `tsc --noEmit` clean on all six touched files. Verified: adversarial
review (cookie-authoritative guest_id, consent default-off, no cross-guest
attach, flag-gating) before merge.

SPEC IMPACT: None — implements Phase 3b (guest capture UI). A cross-guest ranked
leaderboard needs an aggregate RPC and is deferred (the guest sees a personal
progress meter). Phase 4 = the paid custom vendor challenge (couple 1-tap
approve §3.6); Phase 5 = the vendor completion surface (DPO-gated photo
delivery).
