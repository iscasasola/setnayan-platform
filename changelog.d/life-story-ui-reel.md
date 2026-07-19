## 2026-07-08 · feat(life-story): route + scroll reel + entry points + ✦ opt-in (PR-3, UI)

Life Story's everyday surface (flag-gated `NEXT_PUBLIC_LIFE_STORY`, default off — production-inert):

- `app/dashboard/(account)/life-story/page.tsx` — server route: MomentGraph fetch (or deterministic fixtures via `?fixtures=1` on dev/Vercel-preview only — gate uses VERCEL_ENV since previews build with NODE_ENV=production), surface-only presigning (first 48 moments via `displayUrlsForStoredAssets`), sparse-dignity "chapters still to fill" cards, empty/error states pointing forward.
- `_components/scroll-reel.tsx` — significance-ordered reel with By-time toggle; clips reuse `ClipFrame` (shared ≤3-concurrent/one-audible registry + reduced-motion behavior); null-url tiles render deterministic gradient stills, never broken images.
- `_components/story-people.tsx` + `actions.ts` — "The people in your story" with the reversible ✦ opt-in (`markPersonInMemoriam`): only people the viewer added (`created_by_user_id` gate), two-step quiet confirm, never self, never inferred. Hosted here rather than the plan's people page because that page sits behind the separate connections flag (would be unreachable).
- Entry points: "Life Story ▶" card on the account home (beside Memories Hub) + a banner card on `/dashboard/library` — the everyone-reachable path, since single-event couples bypass the account hub redirect.

Typecheck + lint clean; suite 1161/1161. Behavioral QA on the Vercel preview with the flag set (no local Supabase env on this machine).

SPEC IMPACT: None beyond plan notes — implements `03_Strategy/Life_Story_Build_Plan_2026-07-08.md` §5 with two documented deltas (✦ toggle placement; fixtures gate honoring VERCEL_ENV).
