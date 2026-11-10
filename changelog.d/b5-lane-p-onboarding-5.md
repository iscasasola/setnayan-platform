## 2026-11-10 · refactor(onboarding): every onboarding step draws the house buttons and dropdowns (Lane P slice 5)

Owner, 10 Nov: *"On the onboarding the rule or uniform buttons and design templates is not followed yet."*

- **One bottom bar** — `app/onboarding/_shared/step-bar.tsx` (`StepBar`): Back · Skip · the main verb as the house
  `ActionButton`, in one `useFitRow` row. The wedding shell, the generic `[type]` flow and the Get-together form draw
  it; the open-shop wizard's bar uses the same ActionButtons (its last-step submit stays the `SubmitButton`).
- Bare `<button>`s re-skinned onto `ActionButton` / `PickMenu`, behaviour and copy unchanged; the per-component
  ratchet in `every-onboarding-action-is-the-house-button.test.ts` is lowered to match.
- Guards updated to follow the parts, not weakened: `first-screen-can-cancel.test.ts` (the generic bottom Back is the
  step bar's), `both-sign-up-doors-wear-one-button.test.ts` (Continue/Back are the `.ab` pill).

SPEC IMPACT: None
