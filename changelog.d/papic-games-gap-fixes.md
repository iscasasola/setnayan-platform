## 2026-07-22 · fix(papic-games): close the last ungated fake-door line + document the flag

Two fixes from the Papic Games gap analysis — the only two that are LIVE defects
today (with the flag off), the rest being owner decisions / follow-ups.

- **`app/[slug]/page.tsx`** — the "With Setnayan account" comparison card still
  advertised **"Photo & Video Challenges — fun mini-quests"** with NO
  `papicGamesEnabled()` gate (the sibling line at ~3616 was gated; this one was
  missed in the Phase-1 fake-door cleanup). Because the flag defaults OFF, it
  promised an unbuilt feature in production. Now gated like its sibling, and
  reworded to **"Photo Challenges"** (there is no video-challenge completion path).
- **`.env.example`** — added `NEXT_PUBLIC_PAPIC_GAMES_V1` with a note that it is
  build-time inlined (a bare env flip does nothing until a redeploy — fails safe),
  so the owner isn't left flipping it and seeing no change.

SPEC IMPACT: None — copy/flag hygiene only. Not addressed here (surfaced to the
owner): the launch-scope question (only `vendor_booth` missions exist, so a flip
delivers "auto booth missions," not a game family), and the §4 consent rework
(per-vendor per-completion tap + withdrawal path) that should land before the flag
writes its first consent-ledger row.
