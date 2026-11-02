## 2026-08-29 · fix(papic): you can top up mid-party — and three shipped tints were invisible

Owner: *"not enough, you can always upgrade anytime during the event if you feel
you need to increase more credits for this event."* Choosing an amount is the
one moment on this page where somebody can be wrong and know it, so the answer
sits **inside** the dial rather than in the footnote below it, where the same
fact was buried and weaker. The footnote is de-duplicated rather than left to
say it twice.

Every clause is true of the shipped product: a top-up is its own purchase, it
stacks on whatever the celebration already holds (the same `papicCreditsHeld`
rule the card runs on), and it lands during the party because there is no
renewal to wait for.

### 🚨 And it exposed a defect I had already shipped, twice

**`bg-[var(--x)]/[0.07]` and `text-[var(--x)]/65` RENDER NOTHING.** Tailwind
cannot inject an alpha into an arbitrary `var()` colour, so the declaration is
dropped whole. Measured in a browser, not read:

- the new panel's tint computed `rgba(0,0,0,0)` and its gold border fell back to
  **Tailwind's default grey** `rgb(229,231,235)`;
- **the recommendation panel shipped in #4981 had the same dead tint**, so it has
  been a borderless flat block on the live page since it went out;
- the scan block's panel and the QR loading skeleton, same;
- and **38 `text-[var(--m-ink)]/NN` sites rendered at FULL ink** — every "muted"
  line on the page was the same colour as a heading, so the page had no
  typographic hierarchy at all.

🔑 **This is the "rejected, not thrown" family again, in CSS**: same shape as
`--font-serif` and `--sn-warn`, and it is invisible to both contrast guards —
one only compares token *definitions*, the other only judges pairings where both
sides are opaque, and an alpha fill is neither. **A defect can live in the seam
between two correct guards.**

Fixed with explicit channels (`rgb(138_107_57/0.07)`), which is the pattern this
codebase already uses. The 38 text sites go to **`--m-slate-2`**, the doorway
kit's own muted ink — a real token rather than a faked alpha, and at **5.38:1 on
white** it beats the 4.62:1 the alpha was aiming at.

Re-measured after the fix: panel paints `rgba(138,107,57,0.07)` with its gold
border, text on the tint is **4.93:1** (above the AA floor — tinted panels eat
headroom, which is why it was measured rather than assumed), and muted body copy
is now visibly distinct from a heading.

11,346 unit tests green (exit 0) · typecheck exit 0 · every blocking lint green.

SPEC IMPACT: None.
