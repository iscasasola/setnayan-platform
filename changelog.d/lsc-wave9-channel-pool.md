## 2026-07-26 · feat(live-studio): Setnayan-owned channel pool — platform OAuth + broadcast provisioning (wave 9)

**Owner-confirmed 2026-07-26** (*"so we connect to our setnayan youtube account?"* → **yes**), reaffirming
the 2026-07-23 channel-pool lock and rejecting couple-BYO.
`Live_Studio_Unified_Spec_2026-07-25.md § 4h`, built on Waves 5 (#3709), 6 (#3711) and 7. **DRAFT PR, no
auto-merge.** Everything is dark behind `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`.

### The model

**ONE Setnayan YouTube account, connected once by the owner.** Every event streams on a Setnayan-owned
channel drawn from `live_studio_roam_channel_pool`. The couple never authorises Google and never owns a
channel — which is the whole point: because only Setnayan's account consents, the consent screen can be
**Internal**, and an Internal screen needs **no Google app verification at all**. The brand/scope
verification wall hit 2026-07-25 evaporates. Couple-BYO would force External + verification (weeks) *and*
impose YouTube's ~24-hour first-stream wait on every couple — so a couple buying the day before the wedding
could not stream.

### ① The platform grant is a NEW table, not a widened `oauth_grants`

`live_studio_channel_grants` (migration `20271005100000`), keyed on `channel_pool_id`: **one grant per
CHANNEL, many events over its life** — the mirror image of `oauth_grants`, which is one grant per
`(event_id, provider)`. Three reasons it could not be the same table, and the third is the sharp one:

- `oauth_grants.event_id` is `NOT NULL REFERENCES events` — a pool channel belongs to no event.
- `UNIQUE (event_id, provider)` encodes exactly the wrong cardinality.
- 🚨 **`event_member_reads_oauth_grants` grants `SELECT` on the WHOLE ROW to any authenticated member of
  the event, and the row carries `refresh_token` in plaintext.** RLS is row-level, not column-level. That
  is tolerable for a BYO grant (the couple's own Google account, their own row); it would be a
  **platform-credential leak** here, because these tokens control a channel *other couples' weddings also
  stream on*. Reusing the table would have meant betting that a NULL `event_id` never matches
  `current_event_ids()` — correct today, and exactly the bet a future policy edit silently loses.

So the new table has **RLS enabled and NO POLICY AT ALL** — service-role only, the same posture as
`live_studio_roam_streams` (secret stream keys) and `panood_broadcasts`. No couple, no coordinator, **no
admin session** and no anon key can read a row through PostgREST. `PoolChannelGrantView` (the shape the
admin board renders) has no token field, so a token cannot be leaked by rendering the object; there is no
"reveal credentials" affordance for admins either. **The BYO path is untouched and still works.**

`live_studio_channel_oauth_state` is a sibling CSRF-nonce table for the same reason — `oauth_state.event_id`
is `NOT NULL REFERENCES events`, and a platform connect has no event.

- **Refresh reuses the existing worker.** `/api/cron/oauth-refresh` gains a second pass
  (`refreshPoolChannelGrants`) after its `oauth_grants` sweep — same route, same cadence, same secret. A
  second cron route would be a second thing to schedule and a second thing to forget, and a pool channel
  whose token went stale is a wedding that cannot provision. `needs_reauth` is written on a Google
  rejection so the admin board shows Re-connect instead of failing silently forever.
- **Connect flow reuses the existing redirect URI.** `/api/oauth/youtube/pool/start` (admin-gated +
  flag-gated) returns to the *same* `/api/oauth/youtube/callback`, which disambiguates on the state token.
  One fewer registered URI for the owner to remember. The pool branch sits inside the `if (!stateRow)` arm
  — exactly where the route already returned `state_not_found` — so **no existing connection changes**.
- **Re-consent cannot silently repoint a channel.** Re-connecting an existing pool row refuses if Google
  hands back a different channel id (`channel_mismatch`). A brand-new connect creates its pool row with
  `verified = FALSE`, because Setnayan cannot see whether YouTube has enabled live streaming or whether the
  24-hour wait elapsed — and `checkoutPoolChannel` only ever claims a **verified** channel.

### ② `provisionRoamBroadcasts` is wired — and it is `mirrorRoamManifest`'s FIRST caller

The scaffold's "⛔ NOT WIRED YET — needs the pool channel's own OAuth token, gated on G1 + the OAuth-path
decision" is resolved. End to end: flag check → read the event's zones → check a channel out of the pool →
get **that channel's** token → per zone `liveBroadcasts.insert` → `liveStreams.insert` → `bind` → row in
`live_studio_roam_streams` → `mirrorRoamManifest`.

- **🚫 NO SECOND PAYWALL, as the scaffold instructed.** `mirrorRoamManifest` (§ 4d) stays the only publish
  gate. Creating a broadcast is a cost **Setnayan** pays; it is not a guest-visible act. Provisioning N
  broadcasts for a free host and publishing ONE is the intended shape — the test proves 3 created, exactly
  **1** published, with the other two video ids never serialised. A gate here would be a second rule that
  can disagree with the first, and the way it would disagree is a paying couple's cameras present on one
  surface and missing on another.
- **§ 4c's "not yet observable" is closed.** Guest-pick enforcement and the manifest read gate were real but
  inert because nothing wrote `live_studio_roam_streams`. It bites from here on.
- **Broadcasts are created `unlisted`, deliberately.** Manifest reduction works by *omission*, and omission
  cannot hide a `public` video listed on a channel page — a channel other weddings also use.
- **⭐ A side effect worth naming: the pool model HARDENS the § 4d paywall.** Under BYO, an un-entitled host
  *owned the channel* — so they could open their own YouTube Studio, read all N video ids, and defeat the
  manifest reduction entirely. On a Setnayan channel they have no such access. Enforcement-by-omission
  actually holds now.
- **Idempotent at three layers:** the checkout is a no-op for an event already holding a channel; a zone
  with a live stream is reused, not re-created; and `live_studio_roam_streams_one_active_per_zone` is the DB
  backstop — a `23505` counts as *reused*, not as an error. A double-clicked provision cannot double-spend
  YouTube quota.
- **A lost checkout race now retries onto another channel** (bounded, 4 attempts). The lost-update guard
  was already correct, but on its own it told the loser "no channel available" while other channels sat
  free — two weddings starting in the same second is not exotic on a Saturday.
- **A failed provision does not strand a channel.** No token, or a total YouTube failure with nothing
  created → the channel is released. `releasePoolChannelIfIdle` **refuses** while any stream is still
  `ready`/`testing`/`live`, so a partial success cannot hand a live wedding's channel to the next event.

### ③ Go-live actually stops asking for the couple's Google account

Wave 9's headline promise is not delivered by the ROAM picker alone. The **single directed broadcast** — the
one the program output feeds — goes out through `goLivePanood`, and that action hard-stopped at *"Connect
your YouTube channel first"*. It now resolves a **pool channel token first** and keeps BYO as the fallback
(the legacy Cast room is live and selling on it). Flag OFF, the pool block is skipped and the original path
is byte-identical. The error copy is flag-aware: under Wave 9 it says the missing piece is on **our** side,
because asking the host to connect the very thing the model removed would be advice they cannot act on.

- **Ending a broadcast uses a READ-ONLY token lookup** (`getHeldChannelAccessToken`) so pressing End cannot
  check a channel *out* of the pool as a side effect of stopping.
- **🚫 The pool channel is deliberately NOT auto-released on End.** The obvious move is a bug: § 4h has
  Setnayan handing the **recording** back (VOD pull → dashboard/Alaala) and only *then* wiping and reusing.
  That pull is not built, so releasing on End would let the next wedding claim — and wipe — a channel while
  this couple's ceremony is still the only copy on it. Release is an explicit admin act, with the age of the
  checkout on screen beside the button.

### ④ Admin surface + ⑤ couple-facing readiness

`/admin/live-studio-channels` — connect, verify, rename, cap, release, disconnect; which event holds which
channel and for how long; grant health. `notFound()` when the flag is off and the nav entry is conditional
on the same flag, so with the flag off **the surface does not exist and nothing links to it**. Registered in
`ADMIN_NAV_GROUPS` (Studio), `ADMIN_NAV_DESCRIPTIONS` and the More tab's `activeMatch` per the
orphan-prevention rule. An **orphaned** checkout (event deleted → `checked_out_event_id` set NULL by the FK,
which the partial unique index then stops constraining) is releasable by channel id — nothing keyed by event
can find that row.

`lib/live-studio-readiness.ts` (pure) + `-readiness-server.ts` (reads) + a self-contained
`app/_components/live-studio/broadcast-readiness.tsx`. The split is the Wave 7 pattern, for the Wave 7
reason.

### 🚨 ⑥ HONEST LIMITS — stated, not papered over

- **This does NOT make Live Studio turnkey.** Browsers cannot push RTMP and the native capture app was
  scoped but never built (§ 4c). **Something must still encode the program output — today that is the
  couple's own OBS window-capturing `/panood/program/[eventId]`.** Wave 9 removes the *YouTube-account*
  requirement, **not the encoder.** No phone→RTMP path was built or implied, and a unit test greps the
  readiness copy, the card and the admin board to keep it that way.
- **So `ready` never means "you are on air".** The green headline is *"Ready to broadcast — start your
  encoder"*, and `encoderNotice` is returned on **every** branch including the green one, tested. A wedding
  cannot be re-run; a host who read a green tick as "press GO" would find out during the ceremony.
- **Nothing activates until the owner completes G1** (create + verify the Setnayan channel, enable live
  streaming — the 24-hour wait applies to Setnayan, **once**) and G3 (`YOUTUBE_OAUTH_*`). Readiness reports
  each missing piece by name; it never fakes a state. G4 (quota increase — the ceiling is ~12–15 weddings a
  day) is still owner-side.

### Flag-off proof

Zero files under `app/dashboard/[eventId]/studio/live-studio-control/**` (Wave 8's lane) and zero changes to
`events` column privileges (the security agent's lane). Every new path is inside a
`liveStudioRoamEnabled()` guard: the admin page `notFound()`s and its nav row is not emitted, every admin
action throws, the OAuth start route redirects with `live_studio_disabled`, `provisionRoamBroadcasts`
returns `flag_off` **before touching the database** (tested with a Proxy client that throws on any use),
`resolveEventBroadcastToken` / `getHeldChannelAccessToken` return null, `resolveLiveStudioReadiness` returns
null, and both `goLivePanood` and `endPanoodBroadcast` fall through to their original code with no new
`createAdminClient()` construction.

**One stated exception, in the Wave 7 style:** the cron worker's new pool-grant pass is unconditional. It is
an empty query on an admin-secret route while dark (no grant can exist when the connect flow is gated), and
gating it on the flag would mean a platform token silently going stale the moment the flag were ever
toggled off — which is worse than one no-op `SELECT`.

**Tests:** `apps/web/lib/live-studio-channel-pool.test.ts` — 31 cases: grant shape + channel-keying · RLS
has no policy on either new table · no token in the view type, the page, or the actions · server-only ·
BYO untouched · the callback's pool branch is pure fallthrough · entitled publishes 3 / un-entitled
publishes exactly 1 · no second paywall · unlisted · checkout idempotency + lost-update guard + bounded
retry · single-active-per-zone + 23505-as-reused · failed provision releases · orphaned checkout releasable
· go-live prefers the pool and its copy is flag-aware · End neither claims nor releases · readiness false
without credentials / channel / cameras · the encoder caveat on every branch · no phone→YouTube copy ·
flag-off no-ops. Full suite 3446/3446 · typecheck clean · lint clean · masthead/botnav/navicon guards pass.

### ⚠ Wave 8 coordination

Wave 8 is restructuring the controller into a chrome-less single screen, so this PR makes **zero edits to
that directory** — the readiness card ships as a self-contained server component in shared space and is
**not yet mounted**. Wave 8 (or a follow-up) mounts it in two lines:

```tsx
const readiness = await resolveLiveStudioReadiness(admin, eventId);  // lib/live-studio-readiness-server
{readiness ? <BroadcastReadiness readiness={readiness} /> : null}
```

`resolveLiveStudioReadiness` returns `null` when the flag is off, so the mount site needs no flag check. A
test asserts the card stays self-contained until then.

**SPEC IMPACT:** `Live_Studio_Unified_Spec_2026-07-25.md` § 4h — records the shipped grant shape
(channel-keyed `live_studio_channel_grants`, service-role-only, NOT a widened `oauth_grants`, with the
RLS-leak reason), that provisioning is wired and is `mirrorRoamManifest`'s first caller (closing § 4c's
"not yet observable"), that go-live now prefers the pool channel with BYO as fallback, and the deliberate
**non**-release on End pending the unbuilt VOD pull. `DECISION_LOG.md` — a row for "the platform grant is
channel-keyed and service-role-only" and for "Wave 9 removes the YouTube account, not the encoder".
