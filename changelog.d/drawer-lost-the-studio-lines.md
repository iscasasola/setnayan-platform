## 2026-08-21 · fix(frontdoor): the sidebar drawer lost the line under every Studio product

Owner, looking at the live sidebar: *"content of each got lost."* Every Studio
row rendered as a dot and a bare name — "Papic", "Live Studio", "3D Plan" —
while the one-line explanation of what each product does sat in the served HTML,
invisible.

**A revert list that forgot two entries.** `.fd-toolline` and `.fd-toolplay` are
switched off at `max-width: 1279.98px` for the **72px icon strip**, where they
genuinely do not fit. The `max-width: 1023.98px` block then turns the rail into
a **280px drawer** and restores `.fd-label-text`, `.fd-rlabel`, the sign-in
prompt, the notice and the small print — but not those two. The drawer had ample
room for the text and hid it anyway.

**The other half of the same bug:** the strip also flattens `.fd-row-2l` to a
single 44px centred row, so restoring the text alone would squeeze two lines
into one line's worth of space. The row height is restored with it.

🔑 **WRITTEN `.fd-rail .fd-toolline`, NOT BARE, AND THAT IS THE FIX.** The
strip's `display: none` sits in a **later** block of the same file, so at equal
specificity a bare selector here would lose and change nothing on screen.

🛡 New guard `drawer-keeps-the-studio-lines.test.ts` **evaluates the cascade**
rather than grepping for text — because the obvious guard ("the file contains
`.fd-toolline`") was already true while the bug was live: the rule hiding it IS
that string. It asserts all three states: visible in the 280px drawer, still
hidden on the 72px strip, still visible on the full 240px rail.

🪤 **The evaluator's first version glued CSS COMMENTS into selectors**, inflating
the dot count and corrupting every specificity comparison — it reported the wide
rail as hidden, which is false. Comments are stripped before parsing, and that
is load-bearing rather than tidiness. Same family as every guard in this repo
that matched a comment instead of the code.

**Measured before and after** with that evaluator, at three widths:
`800px` toolline `none` → `revert` · `1100px` unchanged `none` · `1440px`
unchanged visible. The full rail and the icon strip are byte-identical in
outcome; only the drawer changed.

⚠ Reasons about the stylesheet, not about rendered pixels. It proves which
declaration wins. The live symptom is what established the bug.

🪤 **AND THE GUARD ITSELF FAILED TYPECHECK ON THE FIRST PUSH.** Under
`noUncheckedIndexedAccess` a regex capture group is `string | undefined` even
when the match succeeded, so `parseFloat(mx[1])` does not compile. Read into a
local and checked. Behaviour re-measured afterwards and unchanged — the drawer
still resolves `display: revert`, the strip still `none`, the full rail still
visible. **The evaluator was right; only its types were wrong.**

🪤 **AND THE GUARD'S VACUITY FLOOR WAS A MADE-UP NUMBER THAT FAILED CI.** It
demanded `> 200` parsed rules; the stylesheet parses to **180**, so the guard
rejected a stylesheet it should have accepted. The floor exists for a real
reason — a walk pointed at nothing would pass silently forever — but a number
nobody measured is not a floor. Now `> 100` (far under the measured 180, far
over the 0 a broken walk gives) **plus** a demand that it found the SPECIFIC
rules it reasons about, so a parser that quietly stopped finding them fails
here and names the cause.
🔑 **I VALIDATED A PARAPHRASE, NOT THE TEST.** The standalone script I measured
with was a rewrite of the test's logic, and it passed while the test failed.
Re-run by transpiling THE TEST FILE ITSELF: 180 rules, 3 mentions, and all six
cascade assertions green.

Not verified locally: no `node_modules` in this checkout and `npm run build`
cannot complete on this machine. Typecheck, lint and the unit run are CI's.

SPEC IMPACT: None.
