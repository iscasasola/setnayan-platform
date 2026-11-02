# papic-retake-story

## 2026-07-23 · feat(papic): challenge SELECT→COMMENCE→RETAKE + Story reward (picker · clips · music · BYO)

**A1 — Papic Challenges arm-before-shoot (owner 2026-07-23).** The guest panel
(`app/papic/guest/_components/papic-challenge-panel.tsx`) no longer attaches the
*last* capture after the fact: the guest ARMS a challenge ("Start"), the NEXT
capture completes it automatically; cleared challenges show "Retake" (re-arm —
the new capture REPLACES the attachment via the shipped `papic_complete_mission`
upsert-per-(mission,guest); verified on `origin/main`
`supabase/migrations/20270902047075_papic_guest_mission_rpcs.sql`). An armed
indicator shows on the capture stage. Points stay metered at capture — never
refunded on retake (no metering code touched). §4 consent is PER PHOTO: every
completion (first shot and every retake) posts `consentToShare:false`, which the
RPC upsert writes through — a retake resets sharing to private and the per-vendor
consent tap is re-asked fresh for the new artifact. ("Papic Challenges" strings
were already renamed by PR #3565 — no copy sweep repeated here.) Also fixed the
stale "(up to 5s)" shutter hint → 10s (owner 2026-07-22 clip cap).

**A2 — Story reward (≈80% reuse of the shipped client-side reel engine).**
Per `0012_papic/Papic_Challenge_Story_Reward_Build_Brief_2026-07-23.md`:

- ① CLIPS in the plan: `lib/guest-stories.ts` now also gathers the guest's
  tagged clips for the PICKER set — strictly via the geo-stripped
  `clip_web_r2_key` web copy (a clip without one is EXCLUDED; the geo-bearing
  `r2_object_key` original is never served outbound). Pure assembly seam +
  tests: `lib/guest-stories-media-set.ts` / `.test.ts`. The one-tap AUTO reel
  stays photos-only (unchanged, zero-regression path).
- ② PICKER: `guest-story-maker.tsx` adds "Choose photos & music" — pick up to
  10 (STORY_MAX_PHOTOS), any mix of photos + clips, floored at
  STORY_MIN_PHOTOS; plays in pick order. One-tap auto-build stays the default.
- ③ MUSIC choice: owned-catalogue chooser (Pakanta first, then active owned
  tracks) + §16.7 BYO upload — the guest's own audio file becomes an object URL
  for the in-browser renderer and NEVER leaves the device (no upload path
  exists). Silent option included.
- ④ REWARD CTA: after a challenge completion's consent tap, "🎁 You earned a
  Story — make yours →" links to the guest's own `/papic/me/[token]#story`
  (qr_token resolved SERVER-SIDE from the guest-session cookie in
  `app/papic/guest/page.tsx` — never client-supplied).

The guest Story remains DOWNLOAD-ONLY: rendered entirely in the browser
(`lib/reel-render.ts`), no `/reels/render`, no R2 write, no DB row, no hosted
feed. All challenge UI stays behind `NEXT_PUBLIC_PAPIC_GAMES_V1`. No migration.

SPEC IMPACT: None — spec already updated in corpus DECISION_LOG 2026-07-23
(SELECT→COMMENCE→RETAKE row + Story-reward brief). Note: the ~10-item free-pick
supersedes the 2026-05-09 "max 5 guest + 5 couple clips" split (owner-authorised,
logged in DECISION_LOG).
