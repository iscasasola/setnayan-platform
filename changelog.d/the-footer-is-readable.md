## 2026-09-17 · fix(footer): the footer is readable, the DPO line most of all

Every public page carries the marketing footer, and **six of its seven text roles
failed AA** against their own ground (`--hr-bg` #f2f2f0). Nothing down there is large
text — the biggest is 13.5px — so the bar is 4.5:1, not 3:1.

| token | before | roles |
|---|---|---|
| `--hr-grey` #8c8884 | **3.14:1** | tagline · nav links · the DPO email |
| `--hr-grey-2` #a8a4a0 | **2.21:1** | column headings · the base line |
| `--hr-ink` #54514d | 7.04:1 | the wordmark — the only one that passed |

The worst case was the **Data Protection Officer** contact: the words at 2.21:1 and
the address at 3.14:1. The one line on the page the law names was the least readable
thing on it.

The footer now takes two steps of the same warm-taupe family, mixed toward
`--hr-ink`: `--hr-foot-ink` #67635f (5.31:1) and `--hr-foot-ink-2` #716d69 (4.58:1).
All seven roles clear the bar.

⚠ **Scoped to the footer on purpose, and that is the honest half.** `--hr-grey` and
`--hr-grey-2` carry ~54 text roles across the whole marketing reskin and fail there
for the same arithmetic. Repainting both tokens globally would fix all of them — and
would be a site-wide visual change nobody has approved, made under cover of a footer
row. **The rest is reported as a measurement for the owner, not quietly redesigned.**

⚠ **The pair must stay a pair.** Solving both roles to the bar collapses them onto
each other (0.1256 luminance apart → −0.0022, inverted), flattening the hierarchy the
footer is drawn with. So the quieter grey sits at the bar and the louder one a step
past it — three distinguishable tiers: #716d69 → #67635f → #54514d.

Guarded by `apps/web/lib/the-footer-is-readable.test.ts`, which resolves the colours
out of the shipped stylesheet and computes the contrast rather than forbidding a
spelling, pins the ROLES as well as the tokens (a token-only check goes green the day
a rule points back at `--hr-grey`), and asserts the pair stays separated. The
arithmetic is `lib/story-light.ts`'s, not a second copy.

⚠ Its first version was **green about the wrong cell**: the window between selector
and body could slide, so `.hr-foot-base` reported `.hr-foot-base a`'s colour. It now
reads each rule's own block, first `{` to matching `}`. Sabotage-checked four ways
with the role count printed before the colour: each token reverted · a rule pointed
back at `--hr-grey` · the two greys flattened onto one value.

SPEC IMPACT: None.
