## 2026-09-21 · fix(ci): the modal-a11y guard wants the CALL, not the mention

`lib/modal-a11y-adoption.test.ts` could pass without the behaviour it checks for. It cleared any
file whose stripped source `includes` one of three bare strings — `'useModalA11y'`,
`'_components/sheet'`, `'confirm-dialog'`. Two of those are import-PATH fragments, so for them the
import WAS the whole test; and for the first, an `import { useModalA11y } from …` line is code, so
it survives the comment stripper the guard already added.

**Measured before/after on one file, same sabotage both times.** Deleting the real
`useModalA11y({ open, onClose, containerRef })` call from
`app/_components/report-page-button.tsx` while leaving its import in place:

- against the guard as it shipped: **2 pass / 0 fail — green, and blind**
- against this version: **red, naming that exact file**

That is the same class the guard's own docblock says it already closed once for comments ("prose
about a construct is not the construct, in either direction"). An import is the third form of
mentioning without doing — and it is not hypothetical: it is how the RSVP half sheet (#5790)
shipped a `aria-modal="true"` panel that trapped nothing, with this guard green over it.

**The fix:** every matcher is now a regex that requires a USE.

- `useModalA11y` → `/useModalA11y\s*\(/`
- `<Sheet>` → `/<Sheet[\s/>]/`
- `confirm-dialog` → `/<ConfirmDialog[\s/>]|useConfirm\s*\(/` — checked, not assumed: every current
  importer takes the `useConfirm` hook and none renders the component, so a render-only matcher
  would have been tight AND wrong.

**The sweep was run BEFORE the assertion changed, because a stricter rule that turns up real
defects must not be weakened back to green.** 54 files render `aria-modal`; 53 are cleared by the
tight matchers; 1 is the pre-existing documented exemption. **Newly named: zero.** Nothing was
hiding behind the loose rule, so nothing needed exempting and no file needed a separate a11y fix.

**And the rule itself is now executed, not just used.** `overlayManagesFocus()` is extracted and
driven by fixtures: an import-without-call must be an offender, a call must pass, importing
`<Sheet>` is not rendering it, importing `useConfirm` is not calling it, and a near-miss identifier
(`useModalA11yEnabled`, `typeof useModalA11y`, `<SheetFooter />`) is not evidence. Relaxing any
matcher back to a bare identifier turns those fixtures red — verified by doing it. A scan over the
tree can only say "nobody is an offender today"; it cannot say the rule still tells wired from
unwired, and a rule that stops distinguishing reports a clean tree forever.

SPEC IMPACT: None. Test-only change; no product code, no schema, no locked decision.
