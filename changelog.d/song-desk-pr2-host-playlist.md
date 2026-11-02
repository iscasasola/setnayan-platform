## 2026-07-30 · feat(vendor): the band can finally read the host's playlist — moment by moment, crossed against their own repertoire

Song Desk **PR 2** of [`Song_Desk_BUILD_ORDER_2026-07-27.md`](../Setnayan/Song_Desk_BUILD_ORDER_2026-07-27.md), the owner's priority reorder made concrete: *"let's make this helpful for the host and the band first."*

**The gap.** The couple has been able to build a moment-by-moment playlist since iteration 0016 — processional, first dance, dinner, and a "Don't play these" list — and **the act booked to play it had no way to see it.** Same shape as the gap `20271013090000` closed for `event_song_picks`: the band was the one party who could not read the songs.

**Pure read. No migration, no new policy.** RULE 0 first: `event_playlist_picks_music_vendor_read` **already exists** (migration `20260622000000`, keyed on a booked `event_vendors` row in `band_dj` / `host_emcee` / `choir` / `string_quartet` with a contracted-or-better status). The slot vocabulary is imported from `lib/playlist.ts` (`PLAYLIST_SLOT_TYPES` · `PLAYLIST_SLOT_LABELS` · `groupPicksBySlot`) rather than restated, so PR 6's slot extension lands in one place.

### What the band now sees

Below the flat requests, above the spare repertoire — the order of a musician's questions before a set:

- **the night, moment by moment** — only moments that actually have picks, in wedding-day order, each song carrying **the couple's note** (*"the acoustic version, please"*) — the whole reason to read this screen rather than be told;
- **a flag on what they don't play**, per moment;
- **"Don't play these" crossed the other way up** — the hazard is a banned song the act **does** play, which is the one row on this screen that can ruin a wedding. `hazardCount` is its own number and the emphasis inverts; a banned song they don't play needs no flag, it is already impossible.

### The join is fuzzy, and that is the interesting part

`event_playlist_picks` carries `song_label` + nullable `artist` as **free text** — it never resolved to a `songs` row — while the repertoire is `songs` rows. So `buildHostPlaylist()` matches on normalised text, mirroring the dedup key used everywhere else (`lower(btrim(title)) || '|' || lower(btrim(artist))`: the SQL generated column, `normalizedKey()` in `lib/songs.ts`, `resolve_song_id()`):

- both sides name an artist → they must agree;
- **either side leaves it blank → the title decides**, and the surface shows the *matched* artist beside the pick so a wrong "Perfect" is spottable. A blank artist is common (the studio never required one), so refusing to match on it would report gaps the act does not have.

Repertoire buckets are sorted by artist, so a same-title ambiguity resolves the same way every render instead of by fetch order.

**A branch was deleted for being unkillable.** The first draft preferred exact artist matches over blank-artist ones. No mutation of it could turn a test red — if an exact match exists a compatible one does too, so `inRepertoire` was identical, and `matchedArtist` is only ever set when the pick named nobody. One predicate replaced the ladder.

### Honest edges, both deliberate

- **A song chosen in BOTH places appears twice** — once as a flat request, once under its moment. Cross-matching here would mean inventing a merge rule days before the owner-answered one lands (PR 3: onboarding pre-fills the studio), so the duplication stays visible and labelled. Prod holds zero playlist rows today.
- **The playlist read is scoped by `eventId` only**, because `event_playlist_picks` has no vendor column and its policy keys on `auth.uid()` rather than the handed-in `vendorProfileId`. Documented at the call site: harmless under the frame's mounting rules, worth knowing before the read is copied somewhere they differ.
- An unknown `slot_type` is **dropped, not thrown on** — `groupPicksBySlot` indexes a fixed Record, so a rogue value would `TypeError` on the floor. ⚠ Whoever extends the slot list must extend that Record too (flagged in PR 6's body).

### Tests

19 new in `lib/song-desk.test.ts` §5 (33 in the file, 5403 in the suite, all green). Neutralisation actually run, not asserted: artist rules → plain full-key equality turns **3** red (the blank-artist cases, plus the ragged row whose match rests on a blank artist — the case/padding test correctly survives, since it pins normalisation rather than the artist rules); inverting `hazardCount` turns **exactly the 2** banned tests red and nothing else, which is the point — the two crossings are asserted independently.

SPEC IMPACT: None — `Song_Desk_BUILD_ORDER_2026-07-27.md` and `WHATS_NEXT_INDEX.md` were already updated in the corpus (commit `176b8b9`) when the owner answered all six gates on 2026-07-30. PR 2 was never gated.
