## 2026-11-10 · refactor(onboarding): every onboarding step draws the house buttons and dropdowns (Lane P slice 5)

Owner, 10 Nov: *"On the onboarding the rule or uniform buttons and design templates is not followed yet."*

- **One bottom bar** — `app/onboarding/_shared/step-bar.tsx` (`StepBar`): Back · Skip · the main verb as the house
  `ActionButton`, in one `useFitRow` row. The wedding shell, the generic `[type]` flow and the Get-together form draw
  it; the open-shop wizard's bar uses the same ActionButtons (its last-step submit stays the `SubmitButton`).
- Bare `<button>`s re-skinned onto `ActionButton` / `PickMenu`, behaviour and copy unchanged; the per-component
  ratchet in `every-onboarding-action-is-the-house-button.test.ts` is lowered to match.
- Guards updated to follow the parts, not weakened: `first-screen-can-cancel.test.ts` (the generic bottom Back is the
  step bar's), `both-sign-up-doors-wear-one-button.test.ts` (Continue/Back are the `.ab` pill).

- Bare `<button>` count across `app/onboarding` + `app/open-shop`: **108 → 17**. Spared with `button-ok` (not
  action buttons): photo choice tiles, calendar day cells, the header ‹ rings, the ⓘ dot, THE TICK rows
  (owner 2026-08-11), the extras accordion head, and the Email way (it wears the OAuth buttons' shape).
- The generic date step's mode dropdown offers "Not decided yet" (clears the picks); the wedding's does not —
  its date step's Continue needs a date.

SPEC IMPACT: None
