## 2026-11-18 · fix(addresses): the nested event address never loops, never eats a public file, never reaches the cached copy

Opus review of #7868. Both holes bite only with `NEXT_PUBLIC_U_NESTING_CUTOVER` on.

- An event whose word is an unreserved page word (`recap`, `welcome`, `seat`, `everyone`, `story` …) keeps its bare
  address, and the page redirected that bare address to itself forever. The page's forward is now decided by
  `eventPageForward` (lib/public-event-url.ts), which never forwards to the address it was asked at.
- `bareNestingRewrite` read every 3-word path as a nested event, so files under `public/` the middleware does not skip
  (`/cipher/glyphs/*.json`, `/monogram-studio/fonts/*.ttf`, `/add-ons/demo/*.mp4` …) were rewritten and 404'd, and
  `/{anyone}/{event}/cached/{key}` reached the internal Event Hub copy the middleware otherwise refuses. A deeper path
  now nests only when its third word is one of the event's own pages, and never `cached`.

Guard: `apps/web/lib/the-nested-address-never-loops-or-eats-a-file.test.ts` (red on the pre-fix code).

SPEC IMPACT: None
