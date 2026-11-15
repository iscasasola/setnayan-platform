## 2026-11-14 · fix(maker): a locked tab wears its 🔒 at every width, not only on a phone

The Maker Edit shell's locked tabs (#7625) drew "🔒 Background" from a rule that sat inside the toolbar's phone-only style block (`@media (max-width:1023.98px)` in `stage-tools.tsx`), so at 1280 px the tab was grey with no lock (Controller W1, 2026-11-14). The rule now sits before that block and applies at every width. `lib/a-locked-tab-says-problem-then-solution.test.ts` holds it there (sabotage-checked: moving the rule back inside turns it red).

SPEC IMPACT: None.
