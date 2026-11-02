## 2026-07-21 · feat(live-studio): adjustable split cam in the PROGRAM composite

PR #5 of the Live Studio build order (`Live_Studio_Repackaging_2026-07-08.md` § 10),
stacked on the PR #4 program pop-out. Puts a second camera beside the on-air source
at an operator-set ratio — the "adjustable split cam" owner-locked 2026-07-08.

- **Pick a partner** — every camera tile in the Sources rail gets a `Split` toggle.
  The on-air camera can't be its own partner; cutting PROGRAM to the current split
  partner clears the split rather than mirroring one camera into both panes.
- **Drag the divider** — pointer-events based (trackpad, mouse and touch all work),
  with pointer capture so the drag survives leaving the element. Also fully
  keyboard-operable: `←`/`→` nudge, `Home`/`End` jump to the bounds, with correct
  `role="separator"` + `aria-valuenow/min/max`.
- **Mirrored into the OBS pop-out** — the composite travels over the existing
  bridge (`secondaryStream` + `splitRatio` were already in `ProgramFrame`), so what
  the operator drags is literally what goes to air. No protocol change.

**No server, no schema.** Split is pure client state: the composite is CSS widths
over two `<video>` elements, not a canvas draw loop, so it costs the operator's
device nothing per frame and there is no control-plane row to persist or corrupt
mid-event.

Ratio math lives in `lib/panood-program-bridge` (`clampSplitRatio`,
`splitRatioFromPointer`) rather than inside the component, so it's testable and
shared by both the console and the pop-out — the two surfaces cannot drift.
Clamped to 15–85%: a narrower pane reads as a rendering glitch on the venue screen
and the divider gets hard to grab back. Non-finite input collapses to an even split;
a zero-width track returns null so a drag before layout leaves the ratio alone
instead of snapping to a bound.

4 new unit tests (14 total in the file, all passing via `pnpm test:unit`).
Typecheck + production build clean.

Inert in production — the Split toggle only renders behind
`NEXT_PUBLIC_PANOOD_STREAMING_ENABLED`, which is off.

SPEC IMPACT: None. Implements the already-specced PR #5; no pricing, SKU or
packaging change.
