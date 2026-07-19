## 2026-07-03 · feat(marketing): Setnayan AI comparator — value-first layout so the pop-up reads top-to-bottom

- Reordered the Setnayan AI pop-up into a value-first sequence for easier
  comprehension: **what it is** (eyebrow/title/one-liner) → **your situation**
  (timeline slider · "Compared to" chips · your hourly rate) → **what you save**
  (headline · bars · fine print) → **the offer** (price + CTA, last).
- **Moved the price block from the top to just above the CTA**, behind a hairline
  divider. You now see the savings before the price, and the muted
  `· ₱X across your N months` total sits directly under the bar it comes from —
  reconciling the `/28 days` price with the bar's window total (previously the
  ₱799/28d at the top and the ₱20,474 bar total looked contradictory).
- Added a small **"Compared to"** label above the mode chips so their role as a
  comparison selector is obvious.
- Height budget: trimmed the vertical rhythm and dropped two now-redundant
  lines (a "See what it saves you" lead-in — the button that opens the modal
  already says "See how much it helps" — and the slider's `1 month / 2 years`
  end-caption, since the price line already discloses "/28 days"). The primary
  CTA is fully visible without scrolling down to a 1280×720 desktop viewport
  (verified: CTA bottom 701px ≤ 720px).

SPEC IMPACT: None (marketing layout/ordering; copy and prices unchanged).
