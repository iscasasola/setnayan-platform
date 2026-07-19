## 2026-07-08 · feat(life-story): the flash + period-recap windowing seam (PR-4, UI)

The cinematic life review, flag-gated (`NEXT_PUBLIC_LIFE_STORY`, default off):

- `_components/flash.tsx` + `use-flash-timeline.ts` + `flash.module.css` — fullscreen dark "Night" room (feature-scoped CSS; paper tokens untouched). One GSAP timeline over the beat layers: face-open → weighted moments (Ken Burns) → perspective turn (*"This is how {name} saw that day"*) → ✦ hold → *"Keep giving it days worth remembering"* → event creation. **Safety contract structural:** only slow cross-dissolves + gentle scale exist in the code (no strobe possible); `prefers-reduced-motion` → static contact sheet with the why; any stage interaction pauses instantly; explicit Stop always visible; Escape closes; keyboard operable; media preloads before play; ≤2 live videos.
- `lib/life-story-moment-graph.ts` — `filterMomentGraph(graph, {from,to})`: the **monthly/yearly recap seam** (owner direction 2026-07-08, plan §11). Windows moments+events; people restrict to in-window presence but keep LIFETIME recurrence (a year with Lola still knows she's your person). +3 tests.
- Route page compiles beats server-side (pure), presigns only beat media (≤8), hands the client a serializable view. Placeholder helper extracted to `_components/placeholder.ts` (shared by reel + flash).

Typecheck ✓ · lint ✓ · 1165/1165. QA on Vercel preview: `/dashboard/life-story?fixtures=1` with the flag set.

SPEC IMPACT: Logged — Build Plan §11 (period recaps) + DECISION_LOG row 2026-07-08 already written in the corpus.
