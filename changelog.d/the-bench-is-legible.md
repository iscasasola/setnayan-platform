## 2026-09-09 · fix(bench): the shortlist is legible, in both themes — and a guard that can see it

Two contrast guards ship, both run on every PR, and **both reported all-clear over the
couple's shortlist while it carried text at 2.22:1**. One only reads colours written three
ways and this stylesheet is a fourth; the other's rules are a deny-list of known-bad
values and the values at fault were not on it.

Measured and fixed: `● N locked` 4.18:1 · `In your plan` 4.33:1 · the `Verified` tick
4.43:1 · and **our own `Setnayan` badge at 3.89:1** — the least readable text on the page,
behind no flag. In dark mode the token block re-pointed every neutral and **forgot the
golds**, so the same labels landed at 2.22:1 and 2.32:1; one popover asked for the
app-wide paper, which has no dark value, and would have rendered near-white on white.
`--ink-faint` was used seven times and **defined nowhere**, so the search placeholder
rendered as full-strength body ink.

🔑 globals.css had already worked out the answer and written it beside the token — the
only gold that may carry text. The bench had simply never used it.

New guard `apps/web/lib/the-bench-is-legible.test.ts` **computes** rather than matching:
it reads the colours out of the stylesheet, resolves the tokens, composites the tints over
the real card and works out the ratio in both themes.

⚠ Its own first cut listed the hex values in a table and measured the table — two of six
mutations passed. Rewritten to read the file; 7 mutations, all red.

SPEC IMPACT: None.
