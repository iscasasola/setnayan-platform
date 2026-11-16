## 2026-11-17 · feat(supplier): the desktop layout moves — Today two panes, Shop layout A, a back on cold-opened risen pages

Slice 2 of the P1 supplier drawings. It stacks on #7898 (the W1 walk batch) and #7901 (slice 1, the blue look). This slice only moves where shipped things sit: no new reads, no new actions, and no change below 1280.

- **Today on a computer** (owner 16 Nov, DECISION_LOG "SUPPLIER DESKTOP MAIN PAGES APPROVED").
  - From 1280, the work pane (Needs you today · Also today · Events you run · Coming up) sits beside the Shop pane (400px).
  - From 1600, the Shop pane is 420px and the work pane splits into Needs | Coming up.
  - Two wrappers that are `display: contents` below 1280, plus grid rules in the shipped `supplier-frame.css`. 🔒 `today-is-two-panes-on-a-computer.test.ts`
- **Shop on a computer, layout A** (picks 3–5).
  - From 1280, Analytics, Badges and Makers sit in a 400px side column beside the service cards. The analytics carousel lays out as a 2-across grid (its loop copies and dots step aside), and the cards go 2 across.
  - From 1600, the side column is 440px and the cards go 3 across. 🔒 `shop/the-shop-is-layout-a-on-a-computer.test.ts`
- **A back on a cold arrival** (owner 16 Nov, "NEVER LOSE THE BACK BUTTON").
  - Your details, Settings and Team rise from the avatar with their own ✕. Opened from a deep link or a reload, they had no way back.
  - Each now draws the shipped `BackButton`, which takes its home from `lib/page-home.ts` and returns in place. It sits inside the new `BackWhenNotRisen`, so a risen sheet never shows two ways out. 🔒 `a-cold-arrival-has-a-back.test.ts`

SPEC IMPACT: None. Every move is a 16 Nov approval already in DECISION_LOG.
