## 2026-06-26 · feat(panood): real multicam control-room page (PR4) wired to the control plane

Replaced the static MOCK broadcaster preview at
`app/dashboard/[eventId]/studio/panood/broadcast/page.tsx` with the REAL,
persisting multicam control room — the day-of switcher wired to the PR1-PR3
foundation (`lib/panood-camera-seats` · `panood-screens` · `panood-moments` ·
`panood-control`).

- **Page (server component):** `getCurrentUser` → require control-room
  membership (moderator/couple OR coordinator added as a moderator) → GATE on
  `eventSkuActive(PANOOD_SYSTEM)` (the PAID multicam controller). Non-owner →
  an honest upsell state pointing back at the FREE single-cam livestream on
  `./setup`. Owner → on load `provisionPanoodMomentsAdmin` (idempotent
  seed-when-empty) + `fetchOrInitControlStateAdmin`, then fetch
  cameras/screens/moments/control-state and render the console.
- **Console (`broadcast/control-room.tsx`, client):** PROGRAM monitor
  (placeholder feed reflecting `control_state.program_source`) · SOURCES rail
  (cameras + Photo wall + Live background as tally-bordered sources; tap = on
  air) · MOMENT DIRECTOR (big one-tap moment buttons that recompose
  program + walls) · SCREENS manager (per-screen mode/source) · Go-live toggle ·
  Mark. Optimistic local echo + `useTransition`; errors surfaced via `useToast`.
  Responsive per the locked mobile ruleset (desktop board; mobile = program on
  top + swipeable camera strip + bottom tab Moments/Cameras/Walls + thumb-zone
  Go-live). Video tiles are clearly-labeled placeholders ("preview — live video
  arrives with the streaming rollout").
- **Server actions (`broadcast/actions.ts`):** `setProgramSource` · `setLive` ·
  `fireMoment` (re-reads the moment from the DB, never trusts the client, then
  fans out program + walls) · `setScreenSource` (+ `markHighlight` stub). Each
  re-checks control-room membership + `eventSkuActive(PANOOD_SYSTEM)`, mutates
  through the control-plane admin helpers, then revalidates the path.
  Best-effort, never leaks secrets, degrades on a missing table.

The default is single-stage (tap a source = it's live). DEFERRED to a later PR
(noted in `actions.ts`): Preview/Take two-bus (Director Mode), transition +
overlay + audio-duck/banner persistence, playout heartbeats, replays, a real
`panood_highlight_marks` table (Mark is a stub), and Supabase Realtime push.

SPEC IMPACT: None. (No schema change — uses the PR1-PR3 tables already speced;
the multicam controller surface itself is the 0011 Panood-multicam workstream
already in `Panood_Multicam_Architecture_2026-06-26.md` / `MEMORY.md`.)
