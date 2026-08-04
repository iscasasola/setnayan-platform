## 2026-07-18 · feat(hosts): RA 10173 consent gate on the coordinator host invite (flag-off)

Adds a Data Privacy Act (RA 10173) consent step when a couple invites a
**coordinator** (`wedding_planner_external`) as an event host — the moment the
couple decides to share their event's planning data (guest list + RSVPs,
seating, schedule, vendor chats) with an outside coordinator.

**Correction to the corpus/DECISION_LOG:** the specs claimed a coordinator gets
event access via "auto-grant on booking-lock (PR #2034)." The shipped code does
**not** do that — `finalizeVendor` never touches `event_members`. Coordinator
access comes from the **host-invite flow**: the couple invites (manual "Promote
your coordinator" button on `/dashboard/[eventId]/hosts`, or the generic
co-planner form's role picker) → `lib/coordinator-grant.ts:autoInviteCoordinator`
also auto-creates a *pending* invite on downpayment → the coordinator activates
it by accepting at `/host/accept/[token]`. So the consent gate lives at the
**invite (the couple's share decision)**, not at vendor lock.

What landed:
- Migration `20270729120000_coordinator_access_consents.sql` — audit table
  (event_id · moderator_id · consented_by_user_id · coordinator_email/label ·
  scope_version · granted_at · revoked_at), RLS enabled at CREATE (Pattern B,
  `current_event_ids()` + `is_admin()`).
- `lib/coordinator-consent-gate.ts` — `NEXT_PUBLIC_COORDINATOR_CONSENT_GATE_ENABLED`
  flag, **default OFF** (mirrors `lib/payment-gated-lock.ts`).
- `app/dashboard/[eventId]/hosts/_components/consent-gated-invite-form.tsx` —
  client form wrapper + Data-Privacy modal (unticked checkbox by default,
  Confirm disabled until ticked; names the coordinator, enumerates shared scope,
  states "budget & payments stay private," links revoke). Clones the house
  `ReservationTermsModal` pattern. Covers **both** invite entry points.
- `hosts/actions.ts:inviteHost` — server-side enforcement (rejects a coordinator
  invite without `coordinator_consent=1` when the flag is on) + writes the
  consent record.

Behavior with the flag OFF (the default) is byte-for-byte unchanged: no modal,
no server requirement, no record written. Enforcement flip is **DPO-gated** on
two open sub-decisions (biometric scope-out · decline-path lawful basis) per
corpus spec § 3a.

Deliberately deferred (follow-ups): stamping `revoked_at` on the consent row
when a host is removed (closes the audit loop), and capturing consent on the
`autoInviteCoordinator` downpayment path (that creates a pending invite with no
couple UI moment — needs its own consent-at-accept or deferred-consent design).

SPEC IMPACT: Coordinator role. Canonical design + the auto-grant correction are
in the corpus `Coordinator_Role_Feature_Spec_2026-07-18.md` § 0/§ 1/§ 3a
(updated) and logged at the bottom of `DECISION_LOG.md`.
