## 2026-10-08 · fix(maker-logo): L1 — the Logo opens ready to edit; its panels can no longer fold away

Owner, on Studio › Logo: *"i get stuck with 1 layer and cannot access anything more … no more asking do you
want a logo? this is direct edit already"* (approved replot `LOGO_MAKER_REPLOT_2026-10-08_fable.md`, PR L1).

- `maker-logo.tsx`: opens with the TOP layer picked (`openingPick`) on its tools; a tap on the empty frame
  and a delete never leave nothing picked. The two panels are no longer Maker tools (`useMakerTool` gone)
  and no longer tiles portalled into the lower third's navigator (`IntoLowerThird`/`ltNav` gone) — that
  navigator goes `inert` while any tool is open, which was the trap. Phone: the logo, then one
  `Layers | <layer>` row, then the open panel, in the page's own flow (`lib/logo-maker-layout.ts`,
  row + panel = `--maker-lt-h`, which Studio sets to half the screen for the Logo).
- `maker-details.tsx`: no "Do you want a logo?" strip over the Logo studio. The answer stays Event
  Details' row (and the shipped Maker's guided Logo step).
- Guards: new `lib/the-logo-maker-opens-ready-to-edit.test.ts`; the three guards that pinned the old
  lower-third-tool shape now point at it.

SPEC IMPACT: None beyond the approved replot doc (L1 as designed). Not built from L1's row, by measurement:
the "switch on the Studio Logo row" — `logo_wanted` only drives the retired What's left step, it does not
show or hide the logo on the Cover/QR, so a switch labelled that way would be a false control (owner call);
and `details-workspace.tsx` needed no change — its guided step sheet never runs in the new Maker
(`plan` is null when `stagesStudio`).
