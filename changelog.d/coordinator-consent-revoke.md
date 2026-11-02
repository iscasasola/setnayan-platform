## 2026-07-19 · fix(coordinator): stamp revoked_at on access consents when a host is removed

The RA 10173 coordinator consent audit loop was grant-only: `inviteHost` records the couple's data-privacy consent in `coordinator_access_consents` (migration 20270729120000) when a coordinator invite is created, but nothing ever stamped the table's `revoked_at` column when that access ended — the audit record claimed a consented share was still live after the couple removed the coordinator.

Fix: new server-only helper `apps/web/lib/coordinator-consent-revoke.ts` → `stampCoordinatorConsentRevoked(admin, eventId, moderatorId)` sets `revoked_at = now()` on the matching un-revoked consent row(s), wired into all three host-removal paths:

- `removeHost` (couple removes an accepted host) — `app/dashboard/[eventId]/hosts/actions.ts`
- `revokeHostInvite` (inviter revokes a pending invite) — same file
- `declineHostInvite` (invitee declines) — `app/host/accept/[token]/actions.ts`

The stamp is deliberately unconditional (NOT gated on `NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED`): consent rows may exist from a period when the flag was ON, and revoking them is always correct. When no consent row exists (flag OFF at invite time, or a non-coordinator host), the UPDATE matches zero rows — a silent no-op, never an error. Best-effort error posture mirrors the grant half: the helper never throws, so removal/revoke/decline always succeed even if the audit stamp fails (logged via console.error).

No schema change — `revoked_at` already exists on the table.

SPEC IMPACT: Coordinator_Whats_Next_2026-07-18.md §4 revoked_at loop closed.
