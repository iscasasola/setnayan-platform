## 2026-07-26 · feat(live-studio): guest-pick over capped peer-to-peer WebRTC (wave 10)

**Live Studio Wave 10** (owner-decided 2026-07-26 · `Live_Studio_Unified_Spec_2026-07-25.md` § 4j).
Wedding guests on the public event page can switch from the director's cut to any **side
camera**, served **peer-to-peer straight from the operator's phone** — the same transport as
the shipped 1:1 chat call. Stays dark behind `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` (and
`NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` for real media). **One migration.**

**The model.** The director's cut (CH 1) still goes OBS → YouTube: permanent archive, unlimited
viewers, ₱0, **completely untouched by this PR**. Side cameras are live-viewing only, so they
need no YouTube broadcast, no WebRTC→RTMP relay, no stream keys and no OAuth — a guest simply
opens a direct connection to the phone. The trade is that **WebRTC does not fan out**: the phone
uploads one copy per viewer, so guest-pick has a hard ceiling where YouTube has none.

**⭐ The cap is the whole design, and it protects the director's cut — not the guests.**
`GUEST_PICK_MAX_VIEWERS_PER_CAMERA = 3`. The phone already spends ~1.5 Mbps publishing 1080p30
to the host; each guest adds ~0.6 Mbps (`GUEST_PICK_MAX_BITRATE_BPS`, applied via
`RTCRtpSender.setParameters` with `scaleResolutionDownBy: 2` so 600 kbps buys a clean 540p rather
than a smeared 1080p). Three viewers keeps the phone near ~3.3 Mbps; five would be ~4.5 Mbps,
optimistic on Philippine mobile data at a venue where hundreds of guests share one cell. If the
uplink saturates, WebRTC congestion control degrades **every** sender on that phone including the
host feed — so an uncapped guest-pick would let three strangers soften the couple's actual
broadcast. Both constants are named, documented and tunable from real measurements.

**A separate signaling channel, and that is not optional.** Guests use
`panood-guest:{eventId}`, never `panood-rtc:{eventId}`. The host transport is
one-publisher → one-viewer per slot: its publisher holds a single `pc`, re-offers by *closing*
it, and accepts any `rtc-answer` matching the slot. A guest answering there would not join the
camera, it would **take** it, blacking out the couple's own controller mid-ceremony — the exact
hole migration `20270829134804` closed. New predicate
`public.live_studio_guest_rtc_can_access(topic)` + policies scoped to `panood-guest:%`
(migration `20271006520000`); `panood-rtc:%` policies are untouched. Both directions are
DB-tested: the guest predicate refuses host topics and the host predicate refuses guest topics.

**Occupancy is Supabase Realtime presence, not a counter.** A counter leaks — guests leave by
closing a tab, losing signal or locking a phone. Presence reclaims a slot when the socket closes;
a 45 s staleness window (re-beaten every 15 s) covers unclean drops; `g-bye` reclaims instantly
on navigate-away; and the phone drops a peer the moment its connection fails. Admission is
computed identically on every browser (oldest presence timestamp wins, ties broken on viewer id)
so two guests tapping at once resolve the same way on both screens. The phone re-decides
**authoritatively** with `admitViewer` — the advisory guest-side check runs on a machine we do
not control, the phone paying the uplink is the one that cannot be lied to.

**Never a broken player.** Full, refused, unreachable, flag off, entitlement withdrawn — every
failure resolves to the same honest outcome: one plain sentence and the guest is handed back to
the director's cut, which is on YouTube and unlimited. No spinner-forever, no black rectangle.
The operator's own screen shows "N of 3 guests watching your camera" once anybody is.

**The paywall is the existing rule, not a new one.** `shouldOfferGuestPick` takes the *answer*
from `canPublishMultiCam` — the same helper that reduces the YouTube manifest one line away in
the loader (§ 4d) — and never re-derives it. Enforced by omission exactly as the manifest is: an
un-entitled event's roster is `[]`, so the browser is never told a side camera exists and nothing
on the page can open a connection. Re-asked server-side in `startGuestPickSession` so the session
and TURN mint are not an open faucet. Deliberately **not** restated in SQL — that would be a
second copy of a money decision.

**⚠ ₱0 only while connections stay DIRECT.** Cloudflare TURN is billed per GB, and a relayed
viewer-hour at 600 kbps is ~0.27 GB. A fully-relayed 4-hour event with 3 cameras at cap is
~9.7 GB ≈ **₱28–56** depending on whether the provider bills one or both directions; the typical
case (most connections direct) is a few pesos. Expect a **higher** relay share on this surface
than on the host path, because both ends are phones on mobile data behind CGNAT. Guest
connections are tagged `panood-guest` in the existing WebRTC telemetry precisely so that share
becomes a measured number instead of a guess.

**⚠ Privacy, stated not hidden (RA 10173).** Peer-to-peer means the two peers learn each other's
IP address: a guest watching a side camera exposes their IP to the operator's phone and vice
versa. Inherent to P2P — a TURN-relayed connection masks it, a direct one does not — and it is
**new**, since guests previously only ever talked to YouTube. Also new: a guest who taps a side
camera mints a native-anonymous Supabase session (lazily, on tap only, never on page load),
because a private Realtime topic needs a real `auth.uid()`.

**Files.** New: `lib/live-studio-guest-pick.ts` (pure core — constants, admission arithmetic,
roster fetch), `lib/panood-guest-webrtc.ts` (transport), `app/panood/guest-pick-actions.ts`
(gated session + ICE), `app/[slug]/_components/guest-camera-player.tsx`,
`supabase/migrations/20271006520000_live_studio_guest_pick_rtc.sql`. Changed additively:
`roam-watch-picker.tsx` (side-camera pills + player; renders byte-identically with no side
cameras), `watch-live-block.tsx`, `[slug]/_lib/loaders.ts` + `types.ts`,
`panood-camera-publish.tsx` (fan-out started strictly after — and isolated from — the host
publish), `lib/webrtc-telemetry.ts` + `webrtc-telemetry-actions.ts` (new surface tag).

**Tests.** `lib/live-studio-guest-pick.test.ts` (32 · the cap caps, retries are idempotent, a
leaked slot heals, races resolve identically on both screens, malformed presence from other
browsers is dropped, un-entitled ⇒ no cameras, the guest topic can never be the host topic, and
the SQL prefix offset is pinned). `tests/db/live-studio-guest-pick-authz.db.test.ts` (14 · the
two channels refuse each other in both directions, cross-event isolation, the host's switch
really gates, no live camera ⇒ no joinable topic, revocation drops the camera from the roster,
malformed topics deny rather than throw). Full suite 3768 pass · typecheck clean · lint clean ·
production build passes.

**⚠ KNOWN BOUNDARY, not a leak.** Any signed-in session can join the guest topic of **any** event
that has guest-pick on and a live camera — the event page is public, so "any visitor" is the
correct audience. What that permits is consuming a viewer slot (bounded at 3, and refused guests
land on the unlimited director's cut) and seeing that event's SDP/ICE. Documented in the
migration header.

**⚠ NOT WIRED YET.** Nothing writes `live_studio_roam_streams`, so the YouTube roam manifest is
still empty in practice — which is why the picker now also accepts the plain CAST embed as "Main
Stage". Side cameras therefore work on the real shipping configuration (director's cut on
YouTube + P2P side cameras) rather than waiting on stream provisioning.

SPEC IMPACT: `Live_Studio_Unified_Spec_2026-07-25.md` § 4j describes guest-pick as HLS-to-R2.
The owner **replaced that decision with capped peer-to-peer on 2026-07-26** — no R2, no HLS, no
MediaRecorder, no presigns. § 4j needs rewriting to the P2P model, including the cap, the TURN
cost note and the P2P IP-exposure note. A `DECISION_LOG.md` row is owed for the reversal.
