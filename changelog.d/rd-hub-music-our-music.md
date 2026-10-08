## 2026-10-08 · feat(studio): Look › Music › Source ▾ — Our music or Your music

- **Source ▾** in Look › Music (both Makers): **Our music** — Setnayan's own songs, by mood, free to
  use — or **Your music**, the couple's own upload (unchanged). Picking a source only changes what is
  drawn; it writes nothing.
- **Our music** shows the Song row and, on tap, the list by mood with ▶ on every row. A tap on a song
  goes into the draft like every Look change; ✓ Apply publishes it. The list is the tracks an admin
  published at `/admin/hub-music`; it loads lazily (the `maker-details` chunk).
- **No new column and no migration.** The pick is stored where the song already lives —
  `events.site_bg_music_r2_key`, holding a reference into `hub-music/` — so the guest page plays it
  through the shipped `BackgroundMusic`. Which source a song came from is read off that reference
  (`lib/hub-music-ref.ts`).
- The form names a TRACK; the server looks its file up, and only a published track resolves. Apply
  admits the song only while its track is published, and says "is no longer on our music list" when
  it is not.
- **An Our-music pick is free at Apply** (the approved prototype's words: "free to use"); the couple's
  own song stays Event Hub Pro.
- Deleting an event never deletes a shared track's file (the event's cleanup scope is its own folder),
  and a track removed from the list keeps its file while any Event Hub still plays it.

SPEC IMPACT: `HUB_MUSIC_BUILD_STATUS_2026-10-08.md` (corpus). Surfaced for the owner, not decided
here: whether some Our-music tracks should be ◆ (the DECISION_LOG row says "free or ◆"; the table has
no such flag and every track is free).
