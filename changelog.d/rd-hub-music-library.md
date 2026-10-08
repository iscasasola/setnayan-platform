## 2026-10-08 · feat(admin): Event Hub music — the list admins upload, couples pick

- **NEW table `hub_music_tracks`** (migration `20271266495922_hub_music_tracks.sql`): one row per
  Event Hub "Our music" track — title · mood (a closed list of nine, or none yet) · the file's key
  under `hub-music/` in the public media bucket · length and size measured on the server ·
  published · order · who added it. RLS at CREATE TABLE, Pattern H: signed-in people read published
  rows, an admin writes. Not `reel_music_tracks` — that list backs rendered videos.
- **NEW admin page `/admin/hub-music`** (Studio group): the list (▶ · title · mood ▾ · length ·
  published switch), search, ＋ Add for one file or many, a sheet per track, Remove with a confirm,
  and "couldn't read" where an empty list would have been. One server action (`saveHubMusic`,
  add · edit · remove), each move in `admin_audit_log`.
- **The upload reads the file, not its name.** `/api/upload` now treats `hub-music/` as an admin's
  folder (admin · M4A/MP3/AAC · 20 MB). When a track is added the server reads the stored bytes
  (`lib/audio-sniff.ts`): AAC and MP3 are accepted with their real length; Opus in an .m4a wrapper —
  what the music generator exports — is refused with the reason, because it is silent on some iPhones.
- `hub-music/` joins the Website media list, so a file that never became a track is visible there.

SPEC IMPACT: `HUB_MUSIC_BUILD_STATUS_2026-10-08.md` (new, corpus). DECISION_LOG rows of 2026-10-08
("OUR MUSIC IS A LIST THE ADMIN UPLOADS" · "NO APPLE MUSIC") are the rulings this builds; no row changed.
