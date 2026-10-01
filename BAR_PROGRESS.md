# BAR_PROGRESS — PR #6205 (`rd/more-services-row`), 2026-10-01

## Done
- Bar = **Home · Guests · Suppliers · Hub · More** (DECISION_LOG 2026-10-01), taken from the one tree in
  `lib/customer-menu.ts`. The rail says the same words; the only phone-only word is "More" (rail: "More
  Services", which expands to the five services). Registry defaults match. The Maker PAGE keeps its title.
- "Your Team" → "Suppliers": the menu, the registry, the vendors page masthead + title, the takeover masthead,
  the finished-event card, the part label.
- The couple's floating round "Add guest" button is deleted (not hidden). Port-control baseline regenerated.
- Budgets, measured against an origin/main build (dc916d040) in the same session:
  - Maker first load: main 516,615 B → this head **516,959 B** (+344 B) · ceiling 517,120 B (505 KB) · 161 B spare.
  - Shared bundle: main 206,826 B → this head **206,836 B** (+10 B) · ceiling 206,848 B · 12 B spare.
  - The first cut was 505.5 KB (over). The cause was `next/dynamic`, which pulled Next's loadable runtime
    (~4 KB raw) into the event-layout chunk. The fix is a plain `import()`, pinned by the guard.
- Tests: typecheck green, 1,324 related unit tests green, CI node guards and lint green.
- Screenshots at 390: `bar-five-390-home.png` and `bar-five-390-guests.png` in the session scratchpad.

## Next
- CI on #6205, then the owner's check on a phone after deploy.
- The Guests header + is F2's job, not this PR.
