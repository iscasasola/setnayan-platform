# Changelog fragment — folded into CHANGELOG.md at release by scripts/changelog-collect.mjs

## 2026-07-08 · feat(plan3d): lab walk-ins end in chair pull-back sits

Wired the slice-1/2 sit machinery (kit/sit-controller + the InstancedChairs
detach API) into the seating lab's two walk-in seams, replacing the
walk-then-teleport-onto-the-seat handoff:

- **Single walk-in (`Walker`):** the steered path now ends at the sit APPROACH
  POINT (0.55 m behind the chair — `approachPoint`/`SIT_TIMING.APPROACH_M`,
  retargeted in `sendGuest`), where the walker hands the figure to
  `<SitController>`: chair pulls back, guest steps in, turns from the real
  walk-in heading, sits, chair tucks. `onArrive` (the "found their seat" toast)
  now fires at flush-seated, and the existing 1.2 s hold keeps the controller
  mounted until the static seated figure takes over transform-identically.
- **"Walk everyone in" (`Crowd`):** every agent ends its walk in its own sit
  clip. Sits are staggered — arrival enqueues the agent, and the frame loop
  drains the queue under a `MAX_ACTIVE_SITS = 8` concurrency cap with
  `SIT_START_GAP_S = 0.25 s` between starts (each live sit detaches one
  instanced chair + mounts one ActiveChair). Finished sits hold a plain seated
  figure until the whole crowd settles; `onAllArrived` now means "everyone is
  seated", not "everyone stood at their chair".
- **Seated guests now SIT** (`SeatedAvatar` pose 'stand' → 'sit') — the
  slice-2 note's promised follow-up, required so the sit clip's flush handoff
  is invisible. Same `[0, 0, −0.04]` chair-local transform (locked to
  `SIT_TIMING.FIGURE_NUDGE_M`).
- The lab's `InstancedChairs` now pass `tableId` (opt-in detach registry).
- Reduced motion: single walk-in and crowd snap straight to the seated
  end-state, never detach a chair, and still fire every completion callback.
- Atomic swap movers (`MoverToken`) unchanged — the seated figure they hand
  off to simply sits now.

`pnpm typecheck` clean · `pnpm test:unit` 1071/1071 · `pnpm lint` no new warnings.

SPEC IMPACT: None (pure rendering/choreography inside the flag-gated 3D seating lab; no schema, pricing, or flow changes).
