## 2026-07-21 · fix(security): authorize the Live Studio WebRTC signaling channel

🔴 **`panood-rtc:{eventId}` had no authorization of any kind.**

`lib/panood-webrtc.ts` opened a **public** Supabase Realtime broadcast channel keyed only on the
event id, and `realtime.messages` carried **zero policies** (verified against prod 2026-07-21:
`relrowsecurity = true`, `policy_count = 0`). Event ids travel in dashboard URLs and QR links.

**The impact is worse than eavesdropping.** The transport is **one publisher → one viewer per
camera slot**: a phone offers, and whoever answers first owns that stream. A stranger holding an
event id could send `viewer-hello`, answer a camera's offer, and the couple's own control room
would **lose that camera** — a black tile mid-ceremony, on a day that cannot be re-run. They could
also inject fake handshake traffic, and read every SDP/ICE payload (which carries participants'
IP addresses — an RA 10173 exposure).

**The fix is two halves that only work together**, so they ship in one PR:

1. `supabase/migrations/20270829134804` — `public.panood_rtc_can_access(topic)` plus SELECT and
   INSERT policies on `realtime.messages` scoped to `panood-rtc:*`.
2. `lib/panood-webrtc.ts` — the channel is opened with **`private: true`**. RLS on
   `realtime.messages` is evaluated for private channels only; a public channel is
   unauthenticated by definition. Either half alone changes nothing.

**Who may join:** a control-room member (accepted, non-removed moderator, or legacy
`event_members.member_type = 'couple'` — mirroring `lib/panood-control-room-access.ts` so the
signaling gate and the page gate cannot drift), or a camera operator who has actually **claimed**
a live camera on that event. Nobody else. The predicate is `SECURITY DEFINER` because operators
are deliberately not members of the control-plane tables and cannot read the rows proving their
own membership — the same posture as `panood_claim_camera`.

**Blast radius: none.** No policies existed, so private channels were deny-all and nothing in the
app used them. These policies are permissive and topic-scoped.

The policy block is guarded on `to_regclass('realtime.messages')` because the PGlite
migration-replay harness has no Realtime schema; without the guard the entire `test:db` suite
fails to boot. The security-critical half — the predicate — is plain `public` SQL and **is**
replayed and tested.

10 new DB tests against the real replayed schema (`pnpm test:db`): stranger denied, cross-event
denied, moderator/couple/claimed-operator allowed, removed-moderator and revoked-camera both drop
access immediately, malformed and foreign topics deny without throwing, unauthenticated denied.
84 unit tests still pass; typecheck + production build clean.

SPEC IMPACT: None — a security fix to shipped behaviour, no packaging or pricing change.
