## 2026-11-16 · style(couple): the clean warm look reaches the couple side — frames and pages read the tokens

Owner, 16 Nov: page `#F7F5F4`, frames `#FFFFFF` with a soft lift and no 1 px border, "build the color
change throught the website". This is the couple-area sweep (`app/dashboard/**`, `app/receipts/**`,
`app/panood/**`); the token values themselves are set by the shared-layer PR.

- **Frames:** 42 hand-drawn white frames (`rounded-xl border border-ink/10 bg-cream …`) now read
  `--sn-frame-bg` / `--sn-frame-radius` / `--sn-frame-shadow` — no hand-typed border, radius or shadow.
  Fields, popovers, dialogs, icon tiles, tone notices and pressables are left alone.
- **Page:** the dashboard root, Manpower, the receipt page and the Panood demo paint `bg-page`
  (`--sn-page-bg`) instead of `var(--m-paper)` / `var(--m-paper-2)`.
- **Buttons:** six hand-styled main verbs (checkout Done, Save Nikah details, Add the first moment, the three
  Save-the-Date launch buttons) are `ActionButton tone="brand" main`.
- Out of scope and untouched: the guest Event Hub, the Maker's hub preview (`launch/_components/stage-panel/`),
  and every file another open PR edits (listed in the PR).
- Scan: `node build-sessions/shots-sweep-couple/scan.mjs` (before / after counts in the PR body).

**Handover pass (16 Nov):** the branch now stacks on the shared-layer PR (`claude/clean-look-tokens`), which owns the
frame values. The frames read their lift as `shadow-[var(--sn-frame-shadow)]`, which Tailwind 3 compiles to a
shadow COLOUR (measured: `--tw-shadow-color`, no `box-shadow`), so no frame would have lifted; they now use the
token key `shadow-sn-frame`. `no-card.baseline.txt` is left at the shared PR's version (counts only fell) so the
sibling sweeps cannot conflict on its header; the batch regenerates it once.

SPEC IMPACT: None — applies the 2026-11-16 DECISION_LOG rows "THE CLEAN WARM LOOK IS APPROVED" and
"PAGE BACKGROUND = NEUTRAL #F7F5F4"; no new decision.
