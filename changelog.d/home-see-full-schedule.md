## 2026-07-11 · feat(home): "See full schedule" button on the Home Schedule card

The Home Schedule card (couple dashboard) previewed the day-of program but only offered a small header text-link ("Full schedule →") into it. Replaced that with a clear, full-width **"See full schedule →" button** anchored at the bottom of the card, linking into the **Journey view** (`/schedule?view=journey`) — the whole event arc (creation → the day → editorial), not just the day-of program. The redundant header link is removed so the card has one obvious CTA.

- `app/dashboard/[eventId]/_components/event-dashboard.tsx` — Schedule card: drop the header `Full schedule →` link; add a bordered mulberry button footer (`See full schedule →`) to `${base}/schedule?view=journey`. Verified against a rendered mock of the card. `tsc` ✓ · `next lint` ✓ · `next build` ✓.

SPEC IMPACT: None (UI affordance).
