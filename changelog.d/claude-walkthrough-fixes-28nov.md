## 2026-11-28 · perf(event-layout): the viewer's chrome reads start beside the membership gate; the logo gate rides the event read

Walkthrough 28 Nov: event home ~1.2 s to first byte (Guests ~0.8 s), both behind `app/dashboard/[eventId]/layout.tsx`.

- **Before:** membership → the one wait (bell, switcher, unread messages, locale, rail account, search index, referral toggle, nav registry, store shell, event row → profile, guest count) → `await logoPlaysFor(…)` (a trip of its own for a moving logo).
- **After:** the nine chrome reads that name no event start BEFORE the membership await and run beside it; the one wait keeps only what names the event; the logo gate is chained off the event read inside that wait. Every read keeps its own fallback; the reads with none get a `.catch` marker only, so a read left behind by `notFound()` is never an unhandled rejection. Nothing that names this event starts before the gate.
- The ⓘ "Why Apply is off" (`.sn-dot-btn`): measured on the real `DraftButton` markup with the compiled `globals.css` — the `::after` halo already presses ±22 px from the centre (46 × 46) while the circle draws 16 px. No change; the 16 px is the drawn box, not the press.

Guard: new `app/dashboard/[eventId]/the-viewer-chrome-starts-beside-the-gate.test.ts`.

SPEC IMPACT: none.
