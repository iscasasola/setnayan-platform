## 2026-09-20 · feat(monogram): ONE button — "Unlock & Apply"

Owner, on the live page: *"keep this reveal and animate & apply should be 1.
Unlock & Apply. One time payment that they can animate their monogram."*

There were two buttons for one intention: "Keep this reveal" (free, saves the
choice) and "Animate & apply · ₱500" (pays). Beyond making the couple do the
bookkeeping, the split let them PAY WITHOUT SAVING — so the animation they bought
could play a different reveal from the one on their screen.

**Now one button records the reveal on screen and THEN opens payment.** It uses a
new, optional `onBeforeOpen` on `InlineCheckoutDrawer`: the save runs first, the
drawer opens once it settles, so what a couple pays for is exactly what they
chose. `onBeforeOpen` is additive — every other add-on page omits it and behaves
exactly as before — and a failed save never blocks the payment, because failing
to record a preference must not stop someone paying for the thing itself.

Three states, one button each:

- **not owned, price readable** → "Unlock & Apply", with "One-time payment, then
  it's yours" beside it
- **owned** → "Apply this reveal" (no payment)
- **store shell, or the catalog price unreadable** → "Keep this reveal", free, and
  NO purchase — nothing is priced from a guess

**One write path, not two.** The non-redirecting save needed the same auth check,
membership test and merge-not-replace config write as the form action. Rather
than keep a second copy of the rule that decides whether a couple's DESIGN
survives a reveal change, `setRevealAction` is now `saveRevealChoice` plus a
redirect. `lint:dup-rule` would not have caught that duplication — it is shaped
like two functions, not a shadowed name — which is why it was worth doing by
hand.

**The price is fetched in one place.** The page resolves it once for the button;
the compact buy row inside `<AnimatedMonogramUpgrade>` no longer renders for an
unowned event, since its button was merged away. The fuller owned / under-review
confirmation still renders beneath the step.

SPEC IMPACT: None.
