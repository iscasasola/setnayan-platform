## 2026-06-29 · feat(papic): walk-up self-register foundation — scan the event QR, get a camera (no roster)

First code landing of the Papic walk-up plan (`0012_papic/Papic_Walkup_Face_Identity_Plan_2026-06-29.md` §1, §5). Until now a Papic guest camera required a pre-existing roster guest (the `setnayan_guest_session` cookie carries a `guest_id` you only get by opening a personal invite). This adds the "self-register on scan" entry — no guest list, no name.

- **Migration `20270321802042`** (schema-first): `guests.self_registered` boolean (marks walk-up cameras so the host roster can filter them + cleanup can target them) + `papic_walkup_register(p_master_qr_token)` — a SECURITY DEFINER, anon-callable RPC that resolves the event by `events.master_qr_token`, **requires the event to own `PAPIC_GUEST`** (reuses `papic_event_owns_service`), inserts a lightweight nameless guest, and returns `{guest_id, event_id, qr_token}`. Idempotent, purely additive.
- **Route `GET /papic/join/[token]`**: resume-or-create. A valid cookie already bound to this event → reuse the camera (fixes "re-scan makes a new camera"); otherwise mint a walk-up guest via the RPC, set the cookie on the redirect, and drop the guest at the existing `/papic/guest` capture surface. Failures fall back to `/papic/guest`'s existing empty states.
- **`lib/guest-session.ts`**: extracted `buildGuestSessionCookie()` (shared cookie spec) so the Route Handler can attach the session cookie directly to the redirect response; `setGuestSession()` now uses it.

PR1 scope = same-device resume (cookie) + create. Cross-device **face** re-entry, the saved-link fallback, the consent/enroll step, the entry-QR surfacing in the host dashboard, and the first-5-free walk-up free tier are the follow-up phases. Stays entirely in the Papic lane (`app/papic/*`, `guest-session.ts`) — no overlap with the parallel "Vids AI" Stories session.

SPEC IMPACT: None — already specified in `0012_papic/Papic_Walkup_Face_Identity_Plan_2026-06-29.md` (owner-approved 2026-06-29). Migration applies via `supabase db push`.
