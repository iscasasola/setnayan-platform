# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-14 · feat(panood): Live Studio camera captures at 1080p @ 30fps

The real Live Studio operator camera (`panood-camera-publish.tsx`) captured with a bare `facingMode: environment` — no resolution — so it published the browser default (~VGA/720p), soft for a paid livestream. Owner set an explicit **1080p** target.

- **`panood-camera-publish.tsx`**: `getUserMedia` video now requests `ideal`+`max` **1920×1080 @ 30fps**. `ideal` degrades gracefully on weaker cameras (no `OverconstrainedError`); `max` caps at 1080p so a 4K-capable phone doesn't publish 4K (too heavy to encode/relay). WebRTC still adapts *down* on poor networks.

Deliberately Live-Studio-specific: the **call** stays 720p (#3231 — lean, unrecorded) and **Papic** stays QHD stills (#3235 — photo quality). Each surface tuned to its job: call = lean, Papic = photos, Live Studio = broadcast sharpness. 1080p ingest is still well within the TURN free-tier cost math (a maxed 8-cam event stays inside 1,000 GB/mo). No migration/schema/price.

SPEC IMPACT: Minor — Live Studio capture-quality tuning (1080p/30fps). Logged in `DECISION_LOG.md`. (iOS/Android native apps remain deferred per owner — finalizing the website look first.)
