## 2026-07-30 · feat(vendor): the requests inbox gets a screen — and the desk stops mounting on one vocabulary while reading on another

Owner, 2026-07-30: **"1. fix the song desk … 3. create the UI."** Two things, one PR, because the fix is what makes the screen usable by the acts it was built for.

### ① The fix — the last mount-vs-read mismatch on this desk

The song desk **mounts** when the vendor holds `song_desk`, granted on the canonical taxonomy tiles in `MUSIC_CANONICALS`:

> `live_band` · `dj` · `choir` · `orchestra` · `wedding_singer`

The playlist **read** gated on a hardcoded list of legacy `vendor_category` enum values:

> `band_dj` · `host_emcee` · `choir` · `string_quartet`

Different vocabularies for different columns — `services[]` holds tiles, `event_vendors.category` holds the enum — and mapping the enum through `vendor-category-taxonomy.ts` shows the two lists **do not cover each other**:

| legacy enum | → tile | in `MUSIC_CANONICALS`? |
|---|---|---|
| `band_dj` | `live_band` + `dj` | ✅ |
| `choir` | `choir` | ✅ |
| `string_quartet` | `choir` | ✅ |
| `host_emcee` | `host_mc` | ✗ gets `stage_script`, never `song_desk` |
| — | `orchestra` | ✗ **no legacy category maps here** |
| — | `wedding_singer` | ✗ **no legacy category maps here** |

**So a booked orchestra or wedding singer held `song_desk`, mounted the desk, and read zero playlist rows** — which, until PR #3893 taught this surface to tell a denied read from an empty one, rendered as *"they haven't set out the night moment by moment yet."* Same family as the crew and grantee defects: the thing deciding whether you **see** the surface and the thing deciding whether you can **read** it were never the same thing.

**The list is dropped, not extended.** Extending keeps a taxonomy in SQL where it drifts from the TypeScript copy every render path uses — and this policy is the proof: it drifted silently for the entire life of the feature. The sibling policy `event_song_picks_booked_vendor_read` already made this exact call, with a comment saying it is *deliberately* not narrowed for precisely this reason. The predicate now collapses onto the two shared helpers (`current_vendor_booked_event_ids` + `current_vendor_dayof_grant_event_ids`), so PR #3893's audiences are admitted **by** those helpers instead of by a second copy of the rule.

⚠⚠ **The exposure consequence, because it is the owner's call:** any booked vendor on the event — the florist, the caterer — can now read the couple's playlist, not only music acts. Already true of `event_song_picks` one table over; the data is song choices; both still require a contracted-or-better booking. If music-only is wanted, the honest route is a `category_key` gate once that column is populated (it is NULL on every prod row and nothing reads it yet), **not** another hand-kept enum list in SQL.

### ③ The UI — the requests inbox

The machinery shipped across three days with no screen: two guest submit lanes with rate caps (#3813), always-on requests (#3891), and the entitlement-checked read/decide path (#3891). This is the screen.

- **It goes FIRST on the desk.** Everything else there is reference — what the couple chose, what you play, what the night looks like. A pending request is the only thing on screen someone is standing there waiting on.
- **Two buttons, no set-picker.** Owner-locked twice: *"accept IS the setlist"* and accepting does **not** file the song into a set. A request lands mid-song; asking a musician to sort it in that moment is a decision they don't need.
- **Pending first; decided collapses** to "You said yes to N" plus a declined count.
- **Optimistic** via `useOptimistic` — a band on stage cannot wait on a round-trip to know a tap registered; `revalidatePath` refreshes the server copy on the next paint.
- **The pause** is wired at last (`setSongRequestsOpen` has had no caller since it shipped). Requests are always on, so there is nothing to switch *on* — this is the one control over the stream. ⚠ Its copy says what it does: a pause pauses **the room**, not just this act's view. ⚠ Owner-path only by PR #3876's deliberate boundary, so a day-of grantee gets *"No vendor profile."* surfaced inline rather than a silent no-op.
- New `fetchSongRequestsPaused` in `lib/vendor-dayof-config.ts`, kept separate from `fetchDayOfOverride` (different column, different question). **FALSE for an absent row** — the table is sparse and no-row means requests are flowing, so "paused" is never rendered from a null.

### Tests

`tests/db/song-desk-read-audience.db.test.ts` — 13 (was 11). **Load-bearing:** remove the migration and **4 fail**. Full `test:db:ci` **640 pass**, `test:unit` **5430 pass**, lint + `dup-rule` + `entitlement-gates` + `migration:check` + 4 style guards all clean.

⚠ **Three of PR #3893's tests were rewritten, and the reason matters:** they asserted on the policy's *literal predicate text* (`vendor_team_members`, `vendor_event_access_grants`, the `revoked_at` clause). Those strings moved into the shared helpers, so string-matching tests broke on a change that admits exactly the same people. They now assert the property at the layer that decides it — the policy delegates to the helper, and the helper is checked (via `pg_get_functiondef`) to include team members and to exclude revoked grants. A test that pins an implementation detail fails on a refactor that preserves the behaviour.

Exposure baseline regenerated: one policy line, the predicate replaced. **This one genuinely widens** — read that line rather than the counts.

### Still not exercisable in prod, and not because of this PR

Prod's only vendor profile is `SetnaProd` — `services: ['pabati']`, free tier, unverified, **0 marketplace-linked bookings**. The desk needs a music-tile vendor on Solo-or-up with a marketplace-linked booking **dated today**. So this UI cannot be opened in prod until such a booking exists; the blocker is data, not code.

⚠ **Flagged, deliberately NOT fixed here:** `vendor_services.category` is consumed as a legacy enum value in `unlock-category.ts` (`insert({ category, category_key: tax.map[category]?.tile })`) but as a canonical `categoryKey` in `inquiry-actions.ts` (lines 504/524 vs 570, where the same value is written into the **enum** column). One column, two contradictory assumptions — one of them is wrong, and the inquiry fallback insert sits inside a `catch {}` that would swallow an enum violation. `vendor_services` has **0 rows in prod**, so there is no data to settle it and fixing it would be fixing a guess. Needs one real vendor service row to resolve.

SPEC IMPACT: the playlist read is no longer music-only — recorded in `DECISION_LOG.md` 2026-07-30 and `Song_Desk_BUILD_ORDER_2026-07-27.md`.
