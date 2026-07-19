### 2026-06-22 — feat(pabati): collector goes live — gated day-of card + 5s guest recorder + recap section

PABATI (the guest video-greeting collector) gets its UI surfaces and is flipped
live. The foundation PR (#2041) shipped the schema (`pabati_clips` + the
`pabati_record_clip` RPC), `apps/web/lib/pabati.ts` helpers, and the
`POST /api/pabati/clip` route. This PR adds the surfaces that consume them:

- **Day-of card** (`apps/web/app/dashboard/[eventId]/_components/day-of-mode/
  video-guestbook-card.tsx`, rewritten from the "coming soon" stub): auto-shows
  only when the event owns the active pack. `pabatiActive` + clean non-hidden
  clips + quota are resolved server-side in the dashboard page (~day-of block)
  and threaded through `DayOfModeGrid`. Active+clips → count + thumbnail strip
  (presigned `<video>`) + share/manage links; active+empty → "0 greetings —
  share the link"; not-active → null (card disappears). Copy fixed
  "60-second" → "5-second video greetings (up to 300)".
- **Guest recorder** (`apps/web/app/[slug]/_components/pabati-prompt.tsx`, new):
  MediaRecorder selfie-cam recorder with a HARD 5000ms client stop (corpus
  5-second cap, mirrored server-side), a first-frame poster JPEG for the NSFW
  screen, and a `FormData` POST to `/api/pabati/clip` (`file`, `poster`,
  `duration_ms`). Shows remaining quota; friendly exhausted/not-owned states.
  Mounted in-context on the guest's landing page (`InvitationSite`, behind the
  active gate) + a standalone share-link entry at
  `apps/web/app/pabati/[eventId]/page.tsx`.
- **Recap section** (`apps/web/app/[slug]/_components/editorial/`): `data.ts`
  mirrors the photo-wall block — `pabatiActive = eventSkuActive('PABATI')` +
  clean non-hidden clips presigned to URLs; `editorial-content.tsx` renders a
  "Video Guestbook" section (new `videoGuestbook` editor toggle). Fails closed
  (owned-but-empty / not-owned → omitted).
- **Go live**: `apps/web/lib/v2-catalog.ts` `PABATI: 'not_built' → 'live'` so
  `/pricing` can sell it now that the collector exists.

Every feature surface gates on `eventPabatiActive` (= `eventSkuActive('PABATI')`,
admin-approved + bundle-aware). 5s cap enforced client (MediaRecorder 5000ms) +
server (route + RPC). No migration in this PR.

SPEC IMPACT: 0031 (day-of guest) / 0012 (Papic family) — Pabati collector goes
live: gated day-of video-guestbook card + 5-second guest recorder + recap
section; v2 catalog flipped to 'live'. Gate is `eventPabatiActive`.
