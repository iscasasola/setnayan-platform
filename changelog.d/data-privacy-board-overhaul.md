## 2026-07-23 · refactor(privacy): overhaul the Data Privacy control board — add, retire, rearrange, and wire the paper records

Reconciles `/admin/data-privacy` against the actual codebase. Five of the eight
original controls were **paper records** (`Active` in the DB but with zero runtime
callers), and two live-in-prod processing activities that had a filed DPIA had **no
control at all**. This makes every control mean what it says.

**Added**
- New status **`retired`** end-to-end (DB CHECK, `PrivacyControlStatus`, `STATUS_META`,
  `VALID_STATUS`, Retire/Restore buttons, a muted "Retired" board section). A control
  whose feature was removed / never built is parked here instead of falsely reading Active.
- Two new controls for live-but-ungated activities, both wired fail-closed:
  - `antifraud_trust_signals` — the automated vendor auto-suspend (an RA 10173 automated
    decision) fired on every couple review with no gate. Seeded **active** (behavior
    unchanged); gate at `maybeAutoSuspendVendor` + `runAutoSuspendSweep`. Detection/scoring
    into the admin queue is unaffected — only the automated suspension is gated.
  - `device_fingerprint` — the coarse per-browser device-id capture. Seeded **inactive**
    (DPO-gated); `recordDeviceHash` now AND-gates the control with the existing
    `NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED` env flag.

**Wired** (paper record → real gate)
- `cross_event_vendor_recall` — `fetchAttendedSavedVendors` (the "from weddings you
  attended" cross-event surface) now returns `[]` when the control is off. Kept **active**
  (feature is live) — this closes a live cross-event linkage gap that had no gate.
- `home_activity_signals` — the `love_story`/`signature_details` SPI written on every
  onboarding commit (wedding `actions.ts` + generic `event-insert.ts`/`commit-event.ts`)
  is stripped when the control is off. Kept **active** (live).
- `faith_religion_graph` + `dependent_minor_profiles` — the Year-view rite moments,
  godchild reminder job, and the minor-SPI writes (`addDependent`, `setDependentSharing`,
  `addGodparent` — the last requires BOTH controls, being a faith-rite edge on a minor)
  plus the People dependents section now AND the control with the
  `NEXT_PUBLIC_DEPENDENT_PEOPLE` env flag. Erasure/delete paths (`deleteDependent`,
  `deleteGodparent`) are left env-only (never control-gated) so a data-subject right is
  never blocked.

The migration force-activates `home_activity_signals` + `cross_event_vendor_recall`
(idempotent, no-op in prod where they're already active) so wiring their first
fail-closed gate is behavior-preserving by construction rather than relying on an
unverified runtime status. Note: between code deploy and this migration applying,
`antifraud_trust_signals` reads inactive, so automated auto-suspend pauses for that
window (detection + admin queue unaffected; enforcement is reversible) — verify the
migration applied on merge.

**Retired / corrected status** (make the board reflect prod reality — flagged for owner sign-off)
- `papic_geo_metadata` → **retired**: no capture path stamps geo (the metadata plumbing
  is dead code hitting a presign-only route). Nothing to gate.
- `faith_religion_graph`, `dependent_minor_profiles` → **inactive**: built but sit behind
  the OFF `NEXT_PUBLIC_DEPENDENT_PEOPLE` env flag + counsel-gated → not live in prod, so
  the honest (and, with the AND-gate, protective) default is Off.

**Rearranged** — risk-grouped board sections via a new `group` field (biometric & sensitive
PI → vendor-mediated → automated/AI → coordinator → onboarding → activation switches →
retired), replacing the flat sort-order list. Migration re-sorts all rows.

**Coverage & drift** — added coverage for the two new controls (`declaredIn` their filed
DPIA/DPO-review); the reverse-drift list (activities declared but ungated) is now empty;
retired controls drop out of the declaration denominator. The four undeclared-active
controls (coordinator consent/prep, vendor AI/deep-search) still surface as red drift.

Migration: `supabase/migrations/20270914100000_data_privacy_controls_overhaul.sql`.

SPEC IMPACT: Board/decision-log only. The `/privacy` legal disclosures + ROPA rows for the
undeclared-active flows and the anti-fraud/device-fingerprint activities remain
owner/counsel actions (tracked as NPC filing tasks t1-4, t2-10, t1-5). No SKU, schema-
rename, or public-surface pricing change. Logged in the corpus `DECISION_LOG.md`.
