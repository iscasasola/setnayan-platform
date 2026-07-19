## 2026-07-12 · feat(home): surface the date-anchor "Your year" moments on the user home

Makes the anchor lifecycle *live where users land*. The launcher home ("Where to?") now shows a **Your year** strip between Your events and Your spaces — the couple's next few DERIVED moments (anniversaries · wedding countdowns), milestones highlighted, with a "See your year →" link to the full `/dashboard/year` view.

- **`(launcher)/_components/year-moments-strip.tsx`** — a self-fetching server component (mirrors the `LifeFlashHomeCard` pattern): pulls only the anchor columns, runs `buildYearMoments`, shows the nearest 3. **Holidays are intentionally excluded** here (they live in the full Year view) so the home stays personal; the strip **renders nothing when the user has no anchors yet** — zero home clutter. Wrapped in `<Suspense fallback={null}>`.
- **`(launcher)/page.tsx`** — renders the strip after Your events.

Zero PII (no birthdate path — that's the counsel-gated dependent layer). Builds on the Year-view PR (#3178).

SPEC IMPACT: None (design: `Event_Anchor_Minimalist_Setup_Design_2026-07-12.md` § 5 — "the Year view ≈ the Membership home surface").
