## 2026-10-26 · fix(look, papic): Look › Background offers its sources in the app · every Papic control saves in place

- **"i cannot see the different background options. upload, color, videos, etc"** (owner, in the app) — the editor
  page built Studio › Look › Background's main-background row (`MainBackgroundPanel`: Source ▾ Colour · Scene ◆ ·
  Video ◆ · Upload ◆ and its cards) only when `!storeShell` (since 2c6a6018ce), so in the app Look fell back to
  Pattern · Blur · Shade · Page colour. Now `lib/main-background-offered.ts`: built on the web, and in the app for an
  event that owns Pro (an unlock belongs to the event). A free event in the shell keeps the shell's rows. The lab takes
  `?shell=1`. Guard: `lib/the-look-background-offers-every-source.test.ts`.
- **"saving minimum and maximum on papic resets the whole screen"** · **"when i turn of a challenge … it jumped to a
  different page"** — every Papic form followed its action's `redirect(...)`; a challenge's eye (no `return_to`) landed
  on the Challenges page. Now each Papic form on the Papic page and Home's Papic card is a `PapicStayForm`
  (`_components/papic-stay-form.tsx`): the same action runs through `in-place-actions.ts`, which reads its redirect as
  an answer (`_lib/papic-in-place.ts` — saved → re-rendered in place; `…_error=` / `add=full` → said on the row;
  signed-out / off-event → let through). 27 forms in 10 files. Must still navigate: the purchase (pay page) and the
  Filter strip's no-JS fallback. Guard: `_lib/papic-saves-in-place.test.ts`.

SPEC IMPACT: None — no schema, copy, price or flow change; the app now shows a Pro event what the web shows.
