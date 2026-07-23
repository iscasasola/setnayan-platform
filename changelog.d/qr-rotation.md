## 2026-07-23 · feat(guest-qr): QR token rotation — audited RPC, leaked-session kill switch, guest self-service (build ④)

On-the-Day build ④ (studies doc § 4 · council verdict § 5.11 · owner-signed
2026-07-23: rotation authority = guests self-service + host/coordinator). A
naked rotation primitive already shipped (`reissueGuestToken` — bare RLS UPDATE,
no audit, no rate limit, no confirm, no notify) and every QR artifact renders
on-demand from the current token; the REAL gap was the 60-day guest-session JWT
never being re-validated against the DB — a session minted from a leaked QR
survived rotation for up to 60 days.

**Migration `20270917400000_guest_qr_rotation.sql` (inert until called):**
`guests.qr_token_rotated_at` + `qr_rotation_count`; `guest_qr_rotations` audit
table (RLS at CREATE — host/admin SELECT only, NO insert policy: the RPC is the
only write path; stores `old_token_sha256`, never the raw token);
`rotate_guest_qr_token()` SECURITY DEFINER RPC — derives the actor kind
server-side (admin/couple/coordinator from `auth.uid()`; `guest_self` only via
service_role after the app validated the signed guest cookie), durable
3-per-guest-per-24h rate limit (admin exempt), same 32-hex mint as the column
default (keeps token-space disambiguation intact). Invalidation is IMMEDIATE —
no grace token; recovery is reshare, not undo. Proven in
`tests/db/guest-qr-rotation.db.test.ts` against the full replayed schema.

**① Session re-validation (flag `GUEST_SESSION_TOKEN_CHECK`, default OFF):**
`readGuestSession()` now optionally verifies the JWT's embedded `qr_token`
still equals `guests.qr_token` — mismatch = signed out. Chokepoint in the
reader itself, so all 24 consumers are covered with zero per-file threading.
Cost when ON: one PK SELECT per request, memoized in-request via React
`cache()`; DB errors fail OPEN (revocation must not become an outage vector).

**② Guest self-rotation (flag `GUEST_QR_SELF_ROTATE`, default OFF):** "Lost
your QR? Get a new one" inside the guest hub's My-QR modal — confirm copy
states plainly that the printed QR + old links die and seat/RSVP/photos stay;
live-window (T-1h..T+8h) rotations require typing ROTATE (owner's
lost-phone-at-the-venue case, never by accident). Server action validates the
cookie AND requires the session token to equal the CURRENT db token (a stale
leaked session can never rotate), calls the RPC as service_role, re-signs the
actor's own cookie so they stay in, and fires a best-effort `security_alert`
notification to all hosts.

**③ Host/coordinator support rotation (ships live — justified):** the bare
"Re-issue" button on `/dashboard/[eventId]/invitation` was ALREADY live and
rotating tokens with zero ceremony; routing it through the audited RPC + a
real confirm dialog is strictly safer, so no flag. Dialog forces an "I'll hand
them the new QR" acknowledgment when the guest has no email; when they do, a
fire-and-forget email tells them their QR changed — NO token/link in the body
("ask your host", RA 10173). Typed-confirm during the live window; "rotated
at" badge from the new column (read defensively pre-migration). Deploy-order
race (app live seconds before the migration) falls back to the legacy direct
UPDATE.

**④ Dead-token fail-closed copy:** `/[slug]/seat?t=` dead tokens now land on a
friendly "This QR code isn't active — ask the guest for their current QR /
check-in desk can find you by name" card instead of a bare 404; the `/[slug]`
`invalid_invite` banner now says the link may have been replaced and to ask
the host for the current one.

SPEC IMPACT: closes council verdict § 5.11 (guest QR rotation) per
`OnTheDay_App_Build_Studies_2026-07-23.md` § 4 — corpus DECISION_LOG row is
logged by the orchestrator, not this PR. Env flags documented in
`.env.example`. Deferred to follow-ups: robots noindex on `/papic/me/[token]`,
analytics scrub of `?invite=`/`?t=`/`?g=` (council § 5(d)), and the fuzzy
name-claim OTP gap (explicitly out of scope per the study).
