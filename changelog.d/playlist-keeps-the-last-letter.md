## 2026-10-23 · fix(music, march): the band reads the last letter the host typed; a refused read is never drawn as what the couple did

From the coordinator walk (owner, 23 Oct: "Keep what we have first and make them run smoothly"):

- **Playlist pick edit lost its last keystroke.** The save runs 600 ms after typing stops but was built from the
  render that scheduled it — one keystroke behind — so the band's Song Desk read "Perfec" while the host saw
  "Perfect · Saved". `playlist-pick-row.tsx` now saves the latest typed values; "Saved" is said only after a save
  landed ("Not saved" after a refusal, nothing before any edit).
- **Song Desk:** a refused read of the couple's picks drew "they haven't picked any songs yet"; a refused repertoire
  read drew "N requests you don't play yet"; a refused picks read beside a vibes read drew "No songs named — they left
  the choices to you". New `readEventSongRequests` / `readVendorSongs` (`lib/songs.ts`) say whether the read failed,
  and the desk says it could not load instead (the old `fetch*` wrappers are unchanged for other callers).
- **Host playlist page:** a failed picks read drew eight empty moments and a tray of "unplaced" songs (every add a
  duplicate). It now says so and offers nothing to add over it.
- **Wedding March (Maker):** a failed march read drew "Nobody walks yet. Give a guest a role…" to a host with a full
  march. `loadMarch` now marks `unread`; the march says "The march couldn't load — Retry" and its row "Couldn't load
  the march".

Guard: `lib/the-band-reads-what-the-host-typed.test.ts`.

SPEC IMPACT: None.
