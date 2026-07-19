## 2026-07-05 · feat(people): cross-person connection name visibility (owner sign-off)

The one RLS decision that was deferred to the privacy review. Owner sign-off
2026-07-05: mutual confirmation IS sufficient consent to store a connection and
show each other's name.

New SECURITY-DEFINER SQL fn `visible_connection_names(person_ids[])` implements
the most conservative reading of that answer:
- **Name only** — returns `person_id` + `display_name`, never email/phone/birth
  date/photo. The base `people` RLS stays owner-only; this does not broaden it.
- **Confirmed connections only** — a name resolves only when the two people share
  a `status='confirmed'` edge. Pending/declined edges reveal nothing.
- **Self-scoped** — resolves the caller's own person via `auth.uid()`; you can
  only ever see names of people you're confirmed-connected to. Not a directory.

`people/page.tsx` now resolves connection names through this fn instead of a
direct `people` select — so confirmed connections are named, while pending/
outgoing requests stay neutral ("Someone"/"Pending") until both sides confirm.

Validated in a rolled-back prod transaction (JWT-claims-simulated caller): a
confirmed counterpart returned by name; a pending counterpart and an unconnected
person were both excluded; only the name was returned. Nothing persisted.

Still flag-off / production-inert: no confirmed edges exist until the Phase-2 flag
is flipped. Going live remains the owner's Vercel flag flip.

SPEC IMPACT: None (implements the already-locked name-visibility rule; owner
sign-off recorded in DECISION_LOG + People_Graph plan §11).
