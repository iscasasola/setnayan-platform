## 2026-08-08 · fix(live-studio): the OTHER way a camera goes missing now reaches the host

`goLivePanood` bound the provisioning result and then read ONE field off it —
`.notice` — which only ever describes the CAP path (`skippedOverCap`). Cameras
go missing a second way: a YouTube refusal sets `detail` and **breaks the
provisioning loop**, so every remaining zone is neither created, nor reused, nor
counted in `skippedOverCap`. `.notice` comes back `null` and the host gets the
same plain green tick the first fix was written to remove — the identical
discard, one level in.

- New pure `hostNoticeFromProvision(result)` in `lib/live-studio-roam-provision.ts`
  folds `detail` into the sentence whenever `ok === false`, and joins it with the
  cap notice when both fired. `detail` passes through verbatim (already host-safe,
  never carries a token or stream key), so there is no second copy to drift.
  `no_zones` / `flag_off` are deliberately NOT folded: the roam flag is on for
  every host and most have zero camera zones, so folding them would put a warning
  on every ordinary single-camera go-live — the noise `cameraDropNotice` already
  refuses to emit.
- `goLivePanood` passes the WHOLE result through it.
- **The old guard pinned the defect IN**: it asserted on the source text
  `notice = provisioned.notice;`. Replaced with behavioural tests over a stubbed
  `ProvisionResult` (both drop paths, both at once, both suppressions, blank
  detail), plus a regression assertion — scoped to the executing region — that
  reading a single field back off the result is gone.
- Both renderers (`go-live-card.tsx`, `transport-row.tsx`) already read
  `result.notice`, so nothing on the screen side changed.

SPEC IMPACT: None.
