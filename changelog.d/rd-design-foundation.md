## 2026-09-24 · feat(design): the design foundation — InfoTip, Readout, Section, SidePanel, tokens and the no-card ratchet

The owner approved "update the kit and build the shared pieces" for the 2026-09-24 design brief.
Additive; no existing screen is restyled and no token is re-pointed.

- **Tokens** (`app/globals.css`, exposed in `tailwind.config.ts`): a `--sn-z-*` layer scale that
  describes the stack as it already is; `--sn-canvas`; borderless glass `.sn-glass-bare` with
  `--sn-sh-float` / `--sn-sh-panel` (a VARIANT — `.sn-glass` keeps its hairline because nine
  panels need it to be visible on the flat ground); `.sn-num` hero number; opt-in
  `.sn-canvas-drift` (off under reduced motion; the ground stays flat by default). Shadows, z,
  durations and eases are now Tailwind utilities (`shadow-sn-float`, `z-sn-panel`,
  `duration-sn-elem`, `ease-sn`).
- **`InfoTip`** (`app/_components/info-tip.tsx`): the one `(i)`. Prints its own required label,
  so a lone circle cannot be written. Hover opens for a mouse, a tap pins, Esc / outside press
  close (decisions in `info-tip-state.ts`). Generalised from the mood board's `InfoButton`, which
  is deleted; the mood board renders the shared one (its popover is now borderless glass).
- **`Readout`** (`app/_components/readout.tsx`): `value: number | null`; null renders "Couldn't
  load", never 0 / ₱0. Money via `formatPhp`.
- **`Section`** (`app/_components/section.tsx`): groups by space and type, no box.
- **`SidePanel`** (`app/_components/side-panel.tsx`): right-hand slide-in at every width, reusing
  the guest card sheet's geometry and keyframes; `useModalA11y`; leaves by transition, never a
  held transform.
- **`lint:no-card`** (`apps/web/scripts/lint-no-card.mjs` + `no-card.baseline.txt`, 769 files ·
  2182 lines): a per-file ratchet on bordered + rounded containers; controls exempt. Blocking CI
  step `guard_no_card` in the aggregator.
- `lint-colour-exists.mjs` now reads the config's `boxShadow` keys, so `shadow-sn-float` is not
  mistaken for a missing colour (exact keys only; a typo still fails).
- `port-control-baseline.json` regenerated: the mood board's `InfoButton` → `InfoTip`.

SPEC IMPACT: `build-sessions/DESIGN-FOUNDATION.md` (new — the one page a builder reads) and
`build-sessions/kit-page-redesign/REDESIGN-PAGE-PROMPT.md` (step 0 now points at it). Rulings
already recorded in the corpus `DECISION_LOG.md` (2026-09-24, "rounded corners stay on what you
can press"); no new corpus edit.
