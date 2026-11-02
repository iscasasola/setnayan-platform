## 2026-07-25 · feat(live-studio): QR camera-join wired to channels (wave 4, dark)

**The gap this closes.** A purchased Live Studio was unusable.
`live_studio_roam_zones.camera_operator_id` shipped with the ROAM foundation and had
**zero writers anywhere in the codebase**, and `live_studio_roam_zones.status` never
left its `'planned'` insert default. So a host could create and name channels but
**no phone could ever join one.** Wave 3 shipped the honest UI for that state
(`channelReadyCaption` → "Waiting for a camera"); Wave 4 is what makes those
captions capable of being true.

**Reuse, not reinvention.** No new auth mechanism. A channel is bound to a seat in
the already-shipped claim stack — `panood_camera_operators` (unguessable UNIQUE
token) · `panood_claim_camera()` · the login-free `/panood/cam/[token]` page ·
`publishPanoodCamera()` · the private-signaling RLS predicate
`panood_rtc_can_access()`. The phone's route to the host is the same WebRTC
transport the legacy control room already uses; there is no parallel pipeline.

- **Join:** every channel now has its own QR in "Manage your channels". Scan → one
  tap → a native-anonymous session claims the seat → that phone IS the channel. No
  install, no login, no Google/Setnayan account.
- **Bind + status lifecycle:** `camera_operator_id` finally has writers
  (`bindChannelCamera` on add + on demand, `reissueChannelCamera`,
  `revokeChannelCamera` on channel delete). New `panood_camera_heartbeat()` RPC
  gives `last_seen_at` the writer it was documented for since day one, and cascades
  to the channel: planned → live → offline. Host-set `'disabled'` is never
  overwritten by a phone.
- **Video reaches the controller.** `watchPanoodCameras` had exactly one caller —
  the LEGACY control room — so a phone joining the unified controller published into
  an empty room. Added the shared viewer (`_components/camera-feeds.tsx`): ONE
  connection for the whole screen (the transport is one-viewer-per-slot; two would
  fight), CH 1 monitor + every tile subscribe to it. Nothing is faked: no stream →
  no `<video>` element → the honest placeholder stays.
- **FREE, per § 4d.** Joining, binding, rehearsing and cutting are host-gated ONLY.
  No `requireLiveStudioOwned` was added anywhere; Wave 3's removal of it stands. The
  paywall remains PUBLICATION (`lib/live-studio-publish.ts`) and is untouched — a DB
  test asserts a free host with two joined, live channels still has a null
  `events.live_studio_roam_manifest` and zero orders.

**🔴 Security — the cross-event rule, enforced by the database.**
`camera_operator_id` was a single-column FK, which does not constrain the seat to
the zone's event. `live_studio_roam_zones` UPDATE RLS is ROW-level and the anon key
is public, so a host could PATCH their own zone to point at another event's seat and
their controller would render **that event's claim token as a QR** — a harvestable
hijack credential. Replaced with a COMPOSITE FK on `(camera_operator_id, event_id)`:
a cross-event binding is now a database error. Claim and heartbeat are event-scoped
by construction (UNIQUE token → one seat → one event, no parameter names an event),
and the heartbeat additionally requires `claimer_user_id = auth.uid()` so a leaked
token is inert. Also: one seat may feed at most one channel; a deleted channel
revokes its QR; a revoked/reissued token is dead to both RPCs.

Also hardened: the controller page now carries a real host gate
(`isLiveStudioSetupHost`, the ONE definition the server actions delegate to as
well) because it reads seat rows through the service-role client — those rows carry
`claim_qr_token`. The raw token never crosses to the client; only the finished claim
URL and rendered QR do, matching the shipped cameras page.

**Honesty.** `resolveChannelStatus` applies the heartbeat timeout at READ time,
because the one transition nobody can write is a phone leaving. A seat nobody holds
reads "Waiting for a camera" even with a fresh-looking heartbeat (the legacy Cast
cameras page can clear a claimer without knowing this channel exists), and a revoked
seat offers "make a new QR" rather than printing a code that silently cannot work.

**⚠ Still missing, stated not stubbed:** the unified controller has no path to air.
The OBS program pop-out (`/panood/program/[eventId]`) reads its frames from the
LEGACY control room's `window.opener` bridge, so cutting a channel here reaches the
host's monitor but not YouTube. That is the owner's YouTube-orchestration gate, not
a Wave 4 omission.

Flag-dark behind `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`; real media additionally
behind `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED`; login-free join behind
`NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED`.

Migration: `20271003100000_live_studio_channel_camera_join.sql`.
Tests: 19 DB (replayed schema — binding · cross-event refusal · stolen-token
inertness · sweep · revocation · anonymous join · no publication) + 13 unit.

SPEC IMPACT: `Live_Studio_Unified_Spec_2026-07-25.md` § 4c — the "nothing writes
`live_studio_roam_zones`, nothing binds a joined phone to a ROAM channel" statement
is now superseded; the join is wired and `camera_operator_id`/`status` have writers.
The § 4c encode-surface correction still holds unchanged: overlays reach air on
`/panood/program/[eventId]`, and this controller still has no path to that surface.
