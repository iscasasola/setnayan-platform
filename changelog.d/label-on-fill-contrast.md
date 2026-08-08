## 2026-08-08 · fix(design): 76 places put text on a fill it could not be read against

The owner ruled *"stick to gold to all first"*, which moved every primary action
onto the standard gold. Measured against it:

```
cream  #FDFBF7 on gold-500 #A9834B  →  3.37:1   FAILS AA
white  #FFFFFF on gold-500 #A9834B  →  3.48:1   FAILS AA
cream  #FDFBF7 on gold-700 #8C6932  →  4.86:1   passes
```

**This is what the palette lock meant by "gold is UI-only".** Gold works as an
eyebrow, a bar, a dot, a border — anywhere nothing sits *on* it. The moment a
word lands on it, it stops working, and nothing in the stack notices: it
compiles, it renders, it screenshots fine, and only a person with ordinary
eyesight in ordinary light finds out.

### 🪤 The near-fix was worse than the bug

The planned change was to sweep 34 buttons from `text-white` to `text-cream`,
because the lock says labels are cream and never pure white. That rule is real —
but it is a **brand** rule, and applying it here moves contrast **3.48 → 3.37**.
An hour of work, a clean diff, a sentence in the PR saying the buttons were
fixed, and the buttons come out very slightly harder to read.

🔑 **The label was never the variable.** No label colour rescues a fill that
light — cream, white, and everything between all land in the 3.3–3.5 band. The
fill is the only thing that can move.

### What changed

- **116 button sites** (73 files) moved to the deeper gold with cream labels,
  plus **48 hover states** that would otherwise have gone *lighter* on hover
  than the button they sat on.
- **5 inline-styled buttons** on the event dashboard and overview inspector.
- **60 more pairings** the guard turned up once it existed — badges, pills and
  muted labels down to **1.93:1** (light gold on pale gold, effectively
  invisible). Every one repaired by moving to a shade that already existed, or
  to one of **five new deeper shades** added beside their own families.

### 🔑 A second gold vocabulary the sweep could not see

The class-name sweep fixed `bg-terracotta` and reported itself done. The guard
then found **five more buttons with exactly the same defect** written as
`background: 'var(--m-orange)'` — inline styles against a parallel `--m-*`
palette holding the identical hex. Same colour, same bug, different vocabulary,
invisible to any search phrased in the first one.

### 🛡 The guard — and why the existing one could not have caught this

`scripts/lint-label-on-fill-contrast.mjs` parses every `bg-*`/`text-*` pairing
and every inline `background`/`color` pairing, resolves both sides through the
real tokens in `globals.css` and `tailwind.config.ts`, computes WCAG contrast
and fails below 4.5:1. **1,366 pairings checked.**

`lib/palette-lock.test.ts` already computes contrast and was green throughout —
correctly. It checks the **token definitions**: is the CTA readable against its
label, does gold have a text-safe escalation. It cannot see which two tokens a
developer actually put in the same className. That is where all 76 lived,
including a 1.93:1 badge built from two tokens the lock test approves
individually. **The palette was accessible; the usage was not.**

Both sides of every comparison are **derived, never re-typed** — move a token
and the arithmetic moves with it.

**No baseline, on purpose.** Every site passes, so it starts at zero. A baseline
is a bill, not a decision: adding a line means deciding somebody reads
unreadable text until further notice.

### 🪤 The guard's own blind spot, found before it merged

The first cut read **only `globals.css`** and only values it could parse
**literally** — and reported all clear. Then a hand-check of one vendor button
led to the admin UGAT console, which paints `--ug-lock` on `--ug-gold-soft`.
Both are declared in its **own** stylesheet as `var()` aliases pointing at the
exact gold/wash pair that was failing everywhere else: **4.21:1, invisible to
the guard.**

🔑 **A guard that only understands values it can read literally reports "all
clear" for everything it cannot parse.** Silence from a checker is not a pass;
it is the absence of an opinion, and the two are indistinguishable from the
outside — the same shape as a rejected query returning no rows.

It now walks **every stylesheet** under `app/`, `components/` and `styles/`, and
resolves `var(--x)` / `var(--x, #fallback)` chains the way a browser would.
Sabotage-tested on the alias path specifically, including a sabotage that edits
**only the stylesheet** and never touches the call site — caught.

Still deliberately out of reach: `color-mix()` and any `rgba()` with alpha,
because both composite against a parent this guard cannot know. Skipped, not
guessed at.

### 🪤 Traps hit while building it

- **A sabotage that never applied.** Two of three sabotage runs died on shell
  quoting and printed a Python syntax error instead of a verdict. They reported
  nothing rather than a false pass only because the harness checks the target
  string is present before editing. **A sabotage run proves nothing unless you
  confirm the sabotage landed.**
- **A sabotage that was not one.** Putting `text-white` back on the *deep* gold
  passed — because 5.02:1 genuinely passes. The cream-not-white rule is brand,
  not legibility, and belongs in the palette lock. Folding it in would make this
  guard fail for two unrelated reasons and get read as noise.
- **Wiring it into CI takes three edits** — the step (`id:` +
  `continue-on-error:`), the env binding, and the `check '...' "$VAR"` line.
  Miss any one and it runs, reports, and can never fail the job.

⚠ **Light mode only.** The dark block in `globals.css` is dormant by design and
puts *ink* on the accent rather than cream; if it is ever re-enabled its accent
`#A88340` under cream scores 3.39:1. Noted in the guard's own header.

SPEC IMPACT: None — implements the owner's 2026-08-08 gold ruling
(`Design_Warm_Editorial_Archive_2026-08-08/ACTION_COLOUR_OVERRIDE_2026-08-08.md`)
at the legibility floor the palette lock already required.
