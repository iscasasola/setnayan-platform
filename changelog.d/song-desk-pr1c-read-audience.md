## 2026-07-30 · fix(security): the song desk read zero for the people who work the night — and said so as if it were the couple's fault

Song Desk **PR 1c** — the three findings from the gap + security audit that followed PR #3885, plus the swallowed error that turned two of them into a user-visible lie.

All three were **latent, not live**, verified against prod rather than assumed: the only two booked music rows are host-manual (`marketplace_vendor_id IS NULL`), with 0 live day-of grants, 0 requests, 0 playlist picks and 0 `vendor_dayof_configs` rows — so no vendor could reach the desk yet. That makes this the cheapest possible moment to fix it.

### ① A vendor TEAM MEMBER read zero playlist rows

`event_playlist_picks_music_vendor_read` (`20260622000000`) hand-rolled its own audience —

```sql
JOIN vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
WHERE vp.user_id = auth.uid()        -- the profile OWNER, and nobody else
```

— while `current_vendor_booked_event_ids()`, the **one** definition of "booked" used by `event_song_picks`, resolves the whole org: owner `UNION vendor_team_members`. **Two definitions of the same word, and the older one was narrower.**

### ② A DAY-OF GRANTEE read zero from *both* song tables

Older and worse than PR #3885. `live/[eventId]/page.tsx` resolves a grantee's vendor profile through the **admin client**, on the stated grounds that *"the grant is the authorization"* — but `SongDesk` reads with the request-scoped client under the grantee's own RLS. A grantee is in neither the owner leg nor the team-member leg, and `current_vendor_booked_event_ids()` excludes grantees too. **So the entire song desk has rendered "the couple haven't picked any songs yet" at crew since PR #3803.**

**Fixed in SQL, not by passing a client through props.** Handing the surface the page's admin client would put a service_role client into `SpecializationSurfaceProps`, where every future specialization inherits it and the registry's *"scope every read yourself"* warning becomes the only thing between a careless query and the whole table. The grant is genuine authorisation, so it belongs in the policy. `current_vendor_dayof_grant_event_ids()` already existed (`20270810694086`: SECURITY DEFINER, `revoked_at IS NULL`, granted to `authenticated`) — no new helper, no new table.

⚠ For the playlist the grantee leg is an explicit `EXISTS` against `vendor_event_access_grants` rather than that helper, because **the helper returns event_ids and drops the vendor binding.** The `EXISTS` keeps `g.vendor_profile_id = ev.marketplace_vendor_id`, so crew granted access by the *florist* cannot read the *band's* playlist on the same event.

### ③ Both song tables still shipped OPEN

Neither `event_playlist_picks` nor `event_song_picks` ever emitted the `REVOKE` every relation in `public` needs — the baseline read `anon SIUD` on both, every column at `anon=SIU`. Not exploitable (all policies are `TO authenticated`, so anon held the grant but no policy admitted a row), but it is the shape that became a hole for `vendor_dayof_configs`. Same treatment as `20271014100000`: **strip `anon` entirely, leave `authenticated` the verbs its policies actually back** — all four here, because both host policies are `FOR ALL` (a couple adds *and* removes songs).

### The swallowed error that made ① and ② into a lie

`fetchPlaylistPicks` collapsed every failure into `[]`. On the couple's own editor that reads fine — nothing to show is nothing to show. On the vendor desk the same empty array became a **sentence**: *"they haven't set out the night moment by moment yet."* A denied read was indistinguishable from an empty one, so a gap on our side rendered as a confident fact about the couple.

It now returns `{ rows, failed }`, and the desk says *"we couldn't load the running order just now — that's on us"* instead. **One function, two call sites updated — no twin helper**, since a second entry point over the same query is exactly what `lint:dup-rule` exists to catch. Both gaps are closed; this branch is the guard that stops the class returning, because the next gap will not announce itself either.

### What is deliberately NOT changed

- **The category list stays.** The audit's first hypothesis was that `band_dj` / `host_emcee` / `choir` / `string_quartet` had drifted from `MUSIC_CANONICALS` (`live_band` / `choir` / `orchestra` / `wedding_singer` / `dj`). **It has not** — those are two vocabularies for two columns. This list is the legacy `vendor_category` **enum**, which is what `event_vendors.category` holds and what real prod bookings carry; the canonical keys live in `vendor_profiles.services[]` and in the dual-written `category_key` column **nothing reads yet**. "Fixing" it would break every booking. A test pins both directions.
- **`current_vendor_booked_event_ids()` is not widened.** That would have fixed ② in one line while silently changing `event_schedule_blocks` and every other consumer. Each policy opts in explicitly; a test is the tripwire.

### Tests

New `tests/db/song-desk-read-audience.db.test.ts` — 11 tests (**638 db / 5430 unit, all green**). **Load-bearing, verified:** remove the migration and **6 of 11 fail**, one per fix; the 5 that pass are the guards on what must *not* change.

Exposure baseline regenerated (**6217 → 6215 facts**): `anon` loses `SIUD` on both tables and every column drops to `anon=-`, `authenticated` untouched, and the two widened policy predicates are in the diff — **this change genuinely widens a read audience**, to crew who already hold day-of console access, which is precisely what that file exists to put in front of a reviewer.

SPEC IMPACT: None outstanding — recorded as PR 1c in `Song_Desk_BUILD_ORDER_2026-07-27.md` + `DECISION_LOG.md` 2026-07-30 (corpus commit `a2979e1`).
