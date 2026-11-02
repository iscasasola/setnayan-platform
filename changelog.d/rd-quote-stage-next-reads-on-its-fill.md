## 2026-09-23 · fix(quote): the stage rail's Next button carries a fill its label can be read against

`lint-label-on-fill-contrast` caught white `text-cream` on `bg-terracotta` in the five-step rail —
**3.48:1, against a WCAG AA floor of 4.5:1.** Measured independently before changing anything, and the
guard's figure is exact.

**The fill moved, not the label** — the guard pre-refutes the label fix and it is right:

| fill | white label |
|---|---|
| `terracotta` #A9834B | 3.48:1 ✗ |
| `terracotta-600` #A88340 | 3.51:1 ✗ |
| **`terracotta-700` #8C6932** | **5.02:1 ✓** |

A light gold cannot carry a word at any label colour; `terracotta-600` buys 0.03.

⚠ **The button was already failing at rest and PASSING on hover** — `hover:bg-terracotta-700` was the
deeper gold all along. The states were the wrong way round.

**The hover now moves AWAY from the label, which is the rule `.button-primary`'s docblock states:**
`hover:brightness-95` darkens `#8C6932` to `rgb(133,100,48)` → **5.44:1**, better than the 5.02:1
resting state. That docblock forbids brightness for the *invite door* button, and the reason does not
apply here: there the label is resolved per couple, so a one-directional move can walk fill and label
together. **This label is always white, so darkening can only improve it** — and both states are
measured above rather than assumed. `hover:brightness` is already an idiom in this repo
(`checklist-full.tsx`, `colour-access-card.tsx`).

🛑 **`.button-primary` WOULD NOT HAVE FIXED THIS, and reaching for it is the trap.** The vendor
dashboard wraps its tree in `.app-surface`, and `.app-surface .button-primary` re-points the house
button to `--sn-gold-500 #A9834B` with `#FFFDF8` — **3.42:1**, the same failure. Its hover
`--sn-gold-600 #95713D` is **4.39:1**, also under the floor.

⚖ **That is a pre-existing defect in a shared class, on every primary button in the vendor dashboard,
and it is NOT fixed here.** The guard does not catch it because it reads Tailwind pairings in TSX, not
CSS custom properties. Raised separately rather than widened into this fix.

**Guard green with a printed count:** `1523 pairing(s) checked, all ≥ 4.5:1`. Sabotage: restore
`bg-terracotta` → red, naming this line.

SPEC IMPACT: None — a fill shade inside an approved component; no copy, no layout, no behaviour.
