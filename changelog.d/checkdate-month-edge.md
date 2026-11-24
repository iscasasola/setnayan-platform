## 2026-11-23 · fix(check-a-date): one whole month on a phone, the next month never pokes in

A live fix the owner approved ("Yes, fix it"). On a phone (360–430 px), Check a date on the public shop page (`/v/[slug]/dates`, and the sheet over the shop) showed a column of the NEXT month beside the current one, for example December's 6 · 13 · 20 · 27 beside November.

- **Cause** (`seat-months.module.css`): each month was `flex: 0 0 88%` of a strip that bleeds 16 px past each gutter, so 41–50 px of the next month was always in view. After paging forward, 2 px of the previous month also showed at the left, because the 14 px gap was smaller than the 16 px bleed.
- **Fix:**
  - On a phone each month is now 100% of the strip.
  - The gap is twice the bleed (32 px). A settled month keeps an even 16 px gutter on both sides, and its neighbours start 16 px out of view.
  - Swipe and keyboard paging still snap one whole month at a time.
  - Desktop (768 px and wider) keeps its own rules, unchanged (14 px gap).
- **`seat-months.tsx`:** the swipe's month index now reads its step from the strip (month + gap), not a typed `14`.
- **Guard:** `app/v/[slug]/dates/check-a-date-month-is-whole.test.ts` reads the phone rules and holds the geometry: month = 100%, and gap ≥ bleed on both sides. All three checks fail on the old stylesheet.
- No server action, no migration, no new reader.

SPEC IMPACT: None. The SHOP-02 v7 note "the next one peeks" is withdrawn by the owner's fix; every month is still a swipe away.
