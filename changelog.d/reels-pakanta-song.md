## 2026-06-22 · feat(reels): use the couple's Pakanta song as the reel backing track

Closes the song→render flywheel gap for reels. The "your wedding's own song backs every Setnayan-rendered video" promise (0036 Pakanta) was unwired for Patiktok reels: the reel render resolved its backing track only from the separate `patiktok_music_tracks` catalogue (and that catalogue isn't ingested yet, so reels rendered silent).

Now, in the reel render's track-selection path (`claimPatiktokRenderJob` in `apps/web/app/dashboard/[eventId]/studio/patiktok/actions.ts`), when the couple has a delivered Pakanta song (`events.pakanta_song_r2_key` non-null) that song is presigned via `displayUrlForStoredAsset` and handed to the renderer in the same `musicUrl` slot it already consumes. The column being set already implies a delivered, paid song, so its presence is the ownership gate.

- **Pakanta song → reel audio when present.** Read directly by column name (the column is applied to prod by migration `20270213200000`; safe even if PR #2038's code is still merging). Member-scoped (RLS) read of the caller's own event row.
- **Catalogue fallback.** When there's no Pakanta song, the chosen `patiktok_music_tracks` track is used exactly as before.
- **Graceful-degrade.** Missing column (`42703`) / missing table (`42P01`) — or a PostgREST schema-cache miss surfacing as a thrown error — is treated as "no song" and falls through to the catalogue path; renders never fail on the lookup.

Note: the audio MUX itself is still stubbed — `patiktok-render.ts` carries `musicUrl` through `RenderOptions` but neither the WebCodecs nor the MediaRecorder path mixes it in yet (owned-catalogue ingestion gates the real mux). This PR wires the *track selection* so the correct song flows into that slot the moment the mux lands. STD film + SDE untouched (the STD film already reads `site_bg_music`; SDE plays crew-delivered audio).

SPEC IMPACT: 0017 Patiktok / 0036 Pakanta — reels now use the couple's delivered Pakanta song as the backing track when present (catalogue fallback otherwise); closes the song→render flywheel gap for reels.
