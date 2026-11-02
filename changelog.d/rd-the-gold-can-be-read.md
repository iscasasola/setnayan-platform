## 2026-09-23 · fix(a11y): the dashboard's gold buttons carry a label that can be read — and the guard can now see them

Owner, asked directly: **"darken it."**

| | label #FFFDF8 | |
|---|---|---|
| `--sn-gold-500` #A9834B | **3.42:1** | was the resting fill |
| `--sn-gold-600` #95713D | **4.39:1** | was the hover — *also* under the 4.5 floor |
| `--sn-gold-700` #8A6B39 | 4.87:1 | resting now |
| `--sn-gold-800` #5C4726 | 8.66:1 | hover now |

⚠ **It failed at rest AND on hover.** A fix touching only the resting state would have left the same
defect one interaction away — the shape that let this survive.

🔑 **THE FILL MOVED, NOT THE TOKEN.** `--sn-gold-500` is also a border, a focus ring and a shadow across
~14 other files; darkening the token would repaint all of them to fix two buttons. Only the two rules
that put TEXT on gold changed (`.app-surface .button-primary`, `.sn-btn-primary`). The decorative
box-shadow deliberately keeps gold-500 — nothing is read on it. **Both new values are rungs of his own
ladder**, not a colour I invented.

⚠ The 700→800 hover step is a big jump because the ladder has no rung between them. If it reads too
dark, the answer is a new mid tone — a design call, flagged not taken.

## Why no guard caught it: the scan never read CSS *rules*

`lint-label-on-fill-contrast` read Tailwind classes, style objects and inline styles — **all in `.tsx`**.
It read `.css` for *variables* and never for *pairings*, so a failure written as a CSS rule was
invisible. **That blind spot is now closed** (`cssRulePairings`), and it required three things that are
easy to get wrong:

- **Comments stripped first.** A `/* … { … } … */` block parses as a rule and its prose becomes a
  selector — the first cut reported three "failures" whose selector was the inside of a comment.
- **State rules inherit their label.** `.x:hover { background: … }` sets no colour; the text comes from
  `.x`. Without this the hover half of this very defect is unreachable.
- **Translucent fills skipped.** What shows through a `rgba(…,.08)` fill is whatever the element sits
  on, which a stylesheet cannot know. Compositing onto the page reported white-on-white at 1.00:1 —
  a confident artefact. **Skipping is honest; guessing the backdrop is not.**
- **`:disabled` exempted** per WCAG 1.4.3 (inactive controls). `.m-btn-primary:disabled` reads 1.63:1
  and that is *correct* — it is what "you cannot press this" looks like.

## The 50 it found are recorded, not fixed, and the list may only shrink

The scan found **50 pre-existing failures across 8 files** nobody was asked to fix (admin UGAT console,
wedding onboarding, home reskin, front door). **Failing the build on all of them would have got the
scan reverted within a day, and a reverted guard catches nothing.** So they are baselined —
`scripts/label-contrast.baseline.txt`, keyed `file · selector`, **never a line number**, with a stale-entry
check so a repaired one cannot sit in the list pretending to be debt. The `.tsx` side stays blocking with
no baseline.

⚠ **ONE OF THE 50 IS THE SAME DEFECT ON A DIFFERENT SURFACE, AND IT IS HIS CALL.** `.m-btn-orange`
paints `#fff` on `--m-orange` — **#A9834B, the identical gold, 3.48:1** — across the public `/vendors`
and `/creators` pages. His ruling was about the supplier dashboard; **I have not widened it to marketing
pages on my own reading.** Baselined and surfaced.

`✓ 1697 pairing(s) checked` (was 1523 — the CSS scan added ~174).

⚠ **AND THE GUARD I WROTE WAS CAUGHT BY ANOTHER GUARD, correctly.** `cssRulePairings` hand-rolled
`rawCss.replace(/\/\*[\s\S]*?\*\//g, '')` to strip comments, and `lint-one-comment-stripper` exists to
stop exactly that. **The irony is the point: I reasoned about how a two-replace stripper mangles
comments while writing one.** Now uses the repo's `stripComments` from `scripts/port-controls.mjs`.

🔑 **Proved the swap changed nothing rather than assuming it:** the guard reports the same
`1697 pairing(s)` and the 50-entry baseline is **byte-identical** before and after. Also checked the
one real risk — `stripComments` removes `//` to end of line, which CSS does not have — and the only
unquoted-looking `//` in the tree is inside globals.css's **quoted** `url("data:image/svg+xml,…http://…")`,
which the stripper skips because it is quote-aware.

SPEC IMPACT: None — a fill shade and a guard's window. No copy, no layout, no behaviour.
