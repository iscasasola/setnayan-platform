## 2026-06-21 · feat(papic): login-free seat claim (scan → tap → camera) + upload/RLS hardening · flag-gated

A friend joining a couple's Papic photo crew no longer has to create an account or sign in. With `NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED=true`, the per-seat claim link lands on a single **"Start shooting"** button — one tap mints a Supabase NATIVE anonymous session (a real `auth.uid()`, reusing the #1912 anon-onboarding machinery), claims the seat, and drops them straight into the camera. The tap can't be zero: the claim fires on the POST, never the GET, so a chat-app link-preview bot can't silently claim the seat. Flag OFF → unchanged sign-in gate (graceful degrade).

Removing the login wall exposed pre-existing gaps the wall was masking, so this ships the hardening alongside (security-review-driven — Option A "anonymous auth" beat a token-capability rewrite that scored *do-not-ship*):

- **`api/upload` (the real fix)** — a new Papic seat branch derives the bucket + event/seat-scoped object prefix SERVER-SIDE from the claim token (caller must be the seat's claimer · seat live · paid-seat entitlement re-checked on the admin client, since the claimer can't read `orders` under RLS), so the client can no longer choose a free-form `pathPrefix` into the media root. Tight per-object byte ceilings on the seat path (12 MB image / 40 MB clip vs the generic 200 MB) + a best-effort per-caller rate-limit backstop (`lib/rate-limit.ts`, per-instance — documented).
- **RLS** — `papic_photos_claimer_own` now binds `event_id` to the seat (closes a cross-event direct-insert hole).
- **5s clip cap** — now also enforced server-side in `recordSeatCapture` (was client-only).
- **Reissue resets caps** — reissuing a seat to a new friend marks the prior claimer's captures `superseded_at` so the new person starts at 0 of the per-seat / free-sampler caps; the old photos stay in the couple's gallery (superseded-still-delivered).
- **Entitlement** — paid-seat captures re-check ownership (refund/lapse stops new writes), mirroring the guest disposable-camera path.

Files: `app/papic/actions.ts`, `app/papic/claim/[token]/page.tsx`, `app/papic/seat/[token]/page.tsx` + `_components/papic-seat-capture.tsx`, `app/dashboard/[eventId]/studio/papic/actions.ts` (reissue), `app/api/upload/route.ts`, `lib/papic-seats.ts` (flag), `lib/rate-limit.ts` (new), `migration 20270207756874_papic_login_free_hardening.sql` (**applied to prod**).

Owner go-live (3 steps, shared with anon onboarding): enable `enable_anonymous_sign_ins` in the Supabase Auth dashboard · apply migration `20270205204166` (null-email trigger) · set `NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED=true`.

SPEC IMPACT: Reverses the iteration-0012 "friend signs in to claim a seat" contract → login-free claim via a native anonymous session (honors the original 0012 "wedding-scoped ephemeral session tokens — not username/password" intent). Logged at the bottom of `DECISION_LOG.md`.
