## 2026-07-22 · fix(coordinator): close consent-gate gap on the auto-invite path + restore checklist→control cross-link

Two code-fixable items from the Data Privacy review.

**(1) Auto-invite bypassed the RA 10173 consent gate.** `autoInviteCoordinator`
(fired as a side effect of marking a booked coordinator's downpayment) inserted
a `wedding_planner_external` delegate — which sees guest PII — but, unlike the
manual `inviteHost` flow, ran no consent check and wrote no
`coordinator_access_consents` row. When the `coordinator_consent_money` Data
Privacy control is **ACTIVE**, that silently granted a PII share with no recorded
couple consent. Fix: the auto-invite now **suppresses itself (fail-closed) when
the control is active** and leaves the couple to promote the coordinator through
the consent-gated manual form (which captures consent + records the scopes).
Control INACTIVE (default) = exact prior behavior. The money wall was already
protecting an auto-invited coordinator (no consent row → no money scope), so this
closes the remaining PII-access hole, not a money hole.

**(2) Restored the task → control cross-link.** The pre-merge NPC Filing page
showed a "Related privacy control →" link on tasks carrying a `relatedControlKey`;
the tabbed-hub port dropped it. Re-added in `npc-checklist.tsx`, now pointing at
`/admin/data-privacy?tab=controls`.

Also audited (no change needed): the consent `revoked_at` loop is already wired
into all three exit paths (remove host, revoke invite, decline invite), and the
consent-scoped money wall (`coordinatorMoneyScopeAllowed`) is enforced fail-closed
at all five money-adjacent coordinator call sites (checkout submit, order create,
payment-proof log, vendor lock, vendor deposit).

SPEC IMPACT: Coordinator_Whats_Next_2026-07-18.md § 4 — the auto-invite path now
respects the consent gate (fail-closed suppression when the control is active);
DECISION_LOG row appended.
