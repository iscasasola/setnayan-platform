## 2026-07-30 · fix(security): requests go always-on, so the paywall moves off the switch and onto the inbox — before booked-is-not-paid becomes exploitable

Song Desk **PR 1b** — a PR that did not exist this morning. It is the direct consequence of two owner answers on 2026-07-30, and it closes the hole those answers opened.

### What the owner decided

- **"Allow requests (anytime)"** means **always-on** — not a mode beside "only during the sets I choose". ⚠ This **reverses the 2026-07-27 lock** (*"the band will open or close accepting requests"*, migration `20271014100000`).
- **The band still gets a pause** for the night or a stretch, because real bands get flooded and the alternative is ignoring the screen.
- So **seeing the requests is the paid part** — the paywall re-sites from the switch to the inbox.

### The hole that created

`event_song_requests_read` / `_decide` gated on `current_vendor_booked_event_ids()` — **"are you booked", which every free-tier band on the event satisfies.** That is the same class of hole PR #3876 closed on the column privilege, one table over. It was inert *only* because the window defaulted FALSE so no request could exist. Always-on removes that accidental safety, so the gate had to land in the same change.

**Both policies lose the booked-vendor leg.** Host (`current_event_ids()`) and `is_admin()` stay. The act reaches its own inbox through `fetchActSongRequests` / `decideActSongRequest` — auth → booking → `holdsSpecialization(access, 'song_desk')` → service_role. **One path, chosen explicitly, no second door left ajar.** Entitlement stays in TypeScript for the reason PR #3876 established: `resolveVendorSpecializationAccessForVendor` folds in the admin free-window promotion and the mid-event lapse, and a SQL copy would drift — a drifting paywall fails open.

### Always-on is not "flip the DEFAULT"

`vendor_dayof_configs` is **sparse** — an absent row means "code defaults", and most bookings never have one. A change that only flipped the column default would leave every unconfigured event shut while claiming to be always-on. So `song_requests_open_for_event()` is inverted to **open unless something says paused**, and the column's meaning inverts to **"not paused"**. No backfill needed: that table holds **0 rows in prod** (checked against the live DB, not assumed).

**PR #3876's column gate is not undone and not wasted** — the pause is still a paid control, so `setSongRequestsOpen` remains the sole write path and `authenticated` still holds no INSERT/UPDATE on that column. A test asserts that explicitly, because this is exactly the kind of change that quietly frees a paid toggle.

### One decision stated rather than hidden

The inbox is per-**event** (`UNIQUE (event_id, song_id)`) while the pause is per-(vendor × event), so two acts can disagree. The faithful inverse of the old rule ("open if EITHER act is accepting") would be "closed only if EVERY booked act has paused" — but that needs a count of booked acts, and because rows are sparse an act that never touched the toggle has no row to count, so it mis-reads the very case it exists for. So: **a pause from any act pauses the room.** One act → identical either way. Two acts → a paused quartet also silences the band, which errs toward *collecting fewer* requests. That is the safe direction: over-pausing disappoints a guest, under-pausing floods a band that asked for silence. A per-act pause needs the inbox split per-act first — schema, not a predicate tweak.

### Also in here

- **The gate is extracted to one function.** `setSongRequestsOpen` had the auth → booking → entitlement preamble inline; two new callers would have made three copies of a paywall, which is three chances for one to drift open. Now one `requireSongDeskAct`.
- **Migration post-conditions** assert against the live catalog (default is `true`; neither policy still mentions the booked helper; an unconfigured event reads open) so a half-applied change fails the migration instead of shipping.

### Tests

`tests/db/song-requests.db.test.ts` **§8** (10 new; 33 in file; **627 db / 5428 unit, all green**). Two existing tests were rewritten because this migration genuinely reverses their premise — "closed by default" became "a paused room", and the per-event test flipped polarity (an unconfigured event now reads OPEN, so per-event reach is proven by pausing here and checking there). **Load-bearing, verified:** with the migration file removed, **6 tests fail** — the four always-on claims, the reversed per-event test, and the booked-is-not-paid security assertion.

⚠ **A correction worth carrying forward:** the first draft of the migration header claimed the exposure freeze passes on removals. It does not. The guard fingerprints **policy predicates** and refuses to mechanically classify any predicate change as a narrowing — so dropping a leg from a `USING` clause fails it until a human reads the diff and regenerates the baseline in the same PR. Done here: `exposure-surface.baseline.txt`, **2 changed facts out of 6217**, both removing `current_vendor_booked_event_ids()`.

SPEC IMPACT: None outstanding — the corpus was updated when the gates were answered (`Song_Desk_BUILD_ORDER_2026-07-27.md` PR 1b, `DECISION_LOG.md` 2026-07-30, corpus commits `176b8b9` + `c0631d2`). This PR implements what those already record.
