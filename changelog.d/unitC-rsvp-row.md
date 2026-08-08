## 2026-08-08 · design(#4): the digest tells you when guests haven't replied

Unit C of the Warm Editorial Archive port — the first genuine *extend* rather than a
restyle. **Zero new queries.**

A row appears in the decisions digest when guests still owe a reply:
`38 guests haven't replied yet` → the roster.

🔑 **THE HONESTY GATE IS THE WHOLE POINT.** It renders only when replies have actually
started arriving (`stats.attending + stats.declined + stats.maybe > 0`). A couple who
has built a roster but sent nothing must never be told *"141 haven't replied"* — before
the first reply, silence is the truthful state. The better gate would be an explicit
"invitations sent" signal; `computeGuestStats` has none, so this is the conservative
substitute, and it is labelled as one rather than presented as exact.

**Three things deliberately not done:**
- **No "nudge them?" copy.** No nudge mechanism ships. A question implying one is a
  fake door.
- **No invented `?filter=pending` param.** A pre-filtered roster view is not stated
  anywhere, so the row links to the plain roster.
- **It does NOT enter `decisionGroups` or `openDecisionCount`.** That number means
  "cockpit decisions + payments"; quietly widening a shipped number's definition is
  worse than the row is worth. The row is appended below the top-3 slice instead.

Singular/plural is handled (`1 guest hasn't` / `38 guests haven't`), and the count is
Space Mono per the numeral rule.

⚠ The gold dot is **inlined** rather than importing Unit B's shared `decisionDotColor`
map, so this ships independently of that PR — identical value, no stacked dependency.
Stacked PRs have orphaned work on this repo before.

**Integration checks** — additive only: zero components removed, zero existing
conditionals removed; the new branch is the only behaviour change and it fails closed
(renders nothing when the data is absent or replies have not started).

Typecheck clean · all 12 `lint-*.mjs` clean · **7092/7092** tests green.

SPEC IMPACT: None.
