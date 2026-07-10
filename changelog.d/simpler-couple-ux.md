## 2026-07-10 · feat(studio): "Recommended for you now" — Studio leads with the couple's next step, not a 24-tile catalog

The couple's core-loop entry (5-tab nav · Home's "Today's one thing" + roadmap-throttled-to-3 · free-by-default Setnayan AI) is already tuned for "easy and simple." The Studio hub was the one surface still reading as a **store**: header "Everything you can make with Setnayan" over ~24 buyable/free add-ons across 4 tabs, with no sense of what to do *first*. That's the paradox-of-choice moment that undoes the guided spine.

This makes Studio **phase-aware**, borrowing the free Home roadmap's one question — *how many months until your date?* — so the hub opens with the 2–3 add-ons that fit where the couple actually is.

- `lib/studio-recommendations.ts` (new · pure): `STUDIO_PEAK_MONTHS` maps each add-on to the months-out where it peaks (foundation → identity → capture → after), and `recommendStudioAddOns({monthsToDate, isEligible, isOwned, limit})` scores by proximity to peak, drops coming-soon / surface-gated / already-owned items, and returns the top N. No AI, no per-couple learning — deterministic date math, same anchor as the roadmap. A date-less couple anchors to early-planning (9mo) so they get the foundation set. Free picks (Mood Board, Save the Date, Seat Plan) are recommendable on purpose — this answers "what to set up next," not "what to buy."
- `app/dashboard/[eventId]/studio/page.tsx`: one lean `events.event_date` read folded into the existing `Promise.all`; renders a "Recommended for you now" strip (reusing `StudioAppRow` + the live pill/href logic) above a new "Browse everything" divider that carries the full catalog. Header softened from "Everything you can make with Setnayan" → "Your Studio" with a lead-with-what-we-suggest subtitle. Timeline-aware lede copy shifts with months-out.

Verified: gradient proven across the timeline (12mo → setnayan-ai/mood-board/website · 6mo → pakanta/monogram · 2mo → papic/panood · 0mo → editorial/event; owned items dropped + backfilled). Typecheck + lint clean.

Note for owner: the sibling "declutter Home" idea from the same review is **already handled** by today's 2026-07-10 owner refactor (Home now IS the `<EventDashboard>` approved prototype — a lean 5-section free state with the AI-only sections gated), so it was intentionally left untouched. The deeper "~45 route folders under one event" is structural and left as a separate follow-up.

SPEC IMPACT: None (in-app Studio UX; no SKU, price, schema, or catalog-content change — the add-on catalog and pricing are unchanged; only presentation ordering + one new pure lib).
