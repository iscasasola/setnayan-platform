## 2026-11-25 · fix(schedule): no hydration error on load — SW-HYDR, final check area 2, batch 7

- Schedule (and /checklist, which forwards there): React error #418 on every load is gone. The layout's saved mark
  was drawn into the page's empty slot before the page's own Suspense boundary had hydrated; it now waits until React
  has claimed the slot (`isClaimedByReact`, `lib/react-claimed.ts`) (A2-P11).
- SW-HYDR's other two IDs (A6-B09 supplier client page, A8·P-B-1 admin pages) are not reproduced here: they need a
  supplier and an admin session on the staging copy. The probe method is in the PR.

Guard: `lib/the-saved-mark-waits-for-its-slot.test.ts`.

SPEC IMPACT: None (no screen change; a load-time error removed).
