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

## 2026-10-08 · feat(look): Music — Source ▾ Our music · Upload your own, ported onto the new Look (amendment PR 6, step 1)

Owner, verbatim (2026-10-08): *"Pick a music from our listing or upload your own"*. The couple
side of #6434 (`rd/hub-music-our-music`) could not be merged into the new Look (it conflicts);
its two commits — 45e761e99 (Source ▾) and c83810021 (the own-song guard) — and its two
follow-up fixes (d2c2a2b04, 35ac984f0) were applied by commit onto this stack. They applied
clean but for the generated port baseline, which was regenerated on this tree. Everything
above this entry is that branch's own changelog. Local commit.

What the port changes against the branch:
- **The second source reads "Upload your own"** (the owner's words; it was "Your music").
- The list's lazy door lives in `scene-styles-lazy.tsx`, the file the Maker warms when idle
  (`maker-tools-are-all-preloaded` requires it) — and the Studio's four font rows moved to the
  same door: that guard was RED on the fonts commit (a8dbfaf9b) and I had not run it.
- The dev lab hands the Music panel three sample songs with no address, so the list can be
  seen there; nothing is fetched or played from the lab.

Refusal words are the branch's, verbatim (`ownSongProblem` / `hubMusicFileVerdict`,
`lib/audio-sniff.ts`) — e.g. "This file is Opus audio in an .m4a wrapper, which does not play
on every iPhone. Export it as AAC or MP3."

Requests (read from the code, not counted with a stub):
- **The Maker's server render: +1 read** — `hub_music_tracks` (published rows), inside the
  page's existing `Promise.all`. BEFORE: 0. ⚠ It is asked on EVERY Maker render, not only
  when Music is opened (the design note says "one list read on opening Music"); asking it on
  open instead needs a new server action or route, and the budget for those is +0. Each
  row's ▶ address is worked out without a request; a preview streams only after ▶.
- A pick from our list: the form's one draft write + 1 read (the track's file, by id,
  published only). An own-song upload: unchanged, plus the bytes are read ON THE DEVICE
  before sending (no request).
- ✓ Apply: +1 read only when the draft holds one of our songs (is its track still published?).
- Exported server actions: 1200 → 1200 (+0).

Guards (the branch's own, ported): `our-music-is-a-pick` 9 · `your-music-plays-on-phones` 5 ·
`hub-music` 13 · `audio-sniff` 13. Re-aimed here, with the reason in each:
`our-music-is-a-pick` (the label; the lazy door's file) · `the-look-is-one-panel` (6) (the
song now drafts from two doors; the two parts are split at the part's own else).
4 sabotages of my adaptations seen red; a 5th stayed GREEN and is said: giving the list a
chunk of its own is not caught by the preload guard (it only asks that the piece is warmed) —
`our-music-is-a-pick` catches it.

NOT in this commit (PR 6, steps 2–3): the guest's music button in three designs; converting a
song on the device.

SPEC IMPACT: None beyond the contract above.
