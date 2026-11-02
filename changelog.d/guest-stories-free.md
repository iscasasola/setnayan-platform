## 2026-06-28 · feat(papic/stories): free Guest Stories — client-side 30s reel from tagged photos

Ships the FREE Guest Stories tier (P1 + P2): a guest taps "Make my Story" on
their personal Papic camera/gallery page and gets a 30s, 9:16 reel built from
their tagged photos, rendered ENTIRELY IN THE BROWSER at ₱0 — no server render
pipeline (that decision stays pending and isn't needed here), no paywall. This
is the free viral loop and consumes Papic's existing tagged gallery (it does
NOT duplicate Papic capture or the Patiktok booth).

P1 — render engine (`lib/patiktok-render.ts`):
- New `<img>` PHOTO branch on both render paths (WebCodecs→mp4 + MediaRecorder
  fallback). `RenderClip.kind?: 'clip' | 'photo'` defaults to `'clip'`, so the
  existing Patiktok booth is untouched. A photo slot paints the still for its
  whole span (no video seek).
- Replaced the even `splitFrames` allocation with a BEAT-AWARE schedule
  (`buildBeatSchedule` + `spansToUnits`): cut points snap to the track's
  `beat_grid` (the JSONB column already on `patiktok_music_tracks`, applied to
  prod) with a `beatsPerCut` stride; NULL `beat_grid` falls back to the exact
  legacy even split. The 5-second hard cap on any CLIP slot is enforced in the
  scheduler AND in the residual-fill (the cap wins over hitting the exact target
  duration). New unit tests cover 90/110/130 BPM, the clip cap, beat-snapping,
  the NULL fallback, and the seconds→units conversion (25 tests, all pass).
- `RenderTemplate.footerLabel?` so Stories stamps "Stories · Setnayan".

P2 — Stories surface (free, no gate):
- `lib/guest-stories.ts` — server-side render-plan reader: the guest's tagged,
  clean-screened photos (same `photo_tags` allowlist as the day-of gallery —
  Papic's untagged-still-delivered + max-10-tags guarantees are upstream and
  untouched) as presigned URLs, a Stories template, and a Setnayan-owned music
  track (`source_url` + `beat_grid`; owned catalogue only, never major-label;
  NULL source → silent render). Enforces a 3-photo minimum.
- `app/papic/me/[token]/actions.ts` — `prepareGuestStory(token)` re-resolves the
  guest from their personal QR (the capability) before building the plan.
- `app/papic/me/[token]/_components/guest-story-maker.tsx` — "Make my Story"
  affordance under the guest's gallery: auto-ranks photos (newest tags first),
  renders client-side, graceful "not enough photos yet" floor, one-tap share
  (`navigator.share`) + download via the shared `save-to-device` primitives
  (new `shareBlobToDevice` helper).
- Client-safe Stories constants moved into the pure `lib/stories-templates.ts`
  so the client surface doesn't pull in the server-only uploads module.

Intentionally NOT built: the PAID SDE clip-compile (P3) and any server render —
both gated on the owner's render-host decision. Everything here is client-side.

SPEC IMPACT: None (no spec/price/schema change — `beat_grid` already shipped;
free tier carries no admin-catalog SKU). The free "Guest Stories" tier and the
client-side ₱0 render boundary are noted in the project's render-pipeline
memory; the paid SDE tier remains owner-gated on the render-host decision.
