## 2026-07-08 · feat(life-flash): richer user-home entry card

Owner "build it" — the plain one-line home card becomes the prototype's inviting doorway: a dark "lights going down" card with the face-row of your recurring people (gradient orbs + initials, ✦ on remembered), the "See your whole life — while you're still in it." line, and a moment/people summary. Links into /dashboard/life-flash.

Async server component (`_components/life-flash-home-card.tsx`), flag-gated by the caller; wrapped in try/catch → degrades to a forward-looking invite card, so a slow/failed graph read never breaks the account home. Empty graph shows the invite, not a rebuke.

Perf note: reuses `fetchMomentGraph` for the summary (bounded, but ~4 sequential round-trips on the account home when the flag is on). A lean summary-only query is a v1.1 optimization if home-page latency warrants it.

SPEC IMPACT: None (Build Plan §5 home-entry, upgraded per owner request).
