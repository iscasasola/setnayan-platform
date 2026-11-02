## 2026-08-01 · feat(papic): Papic Pool is offered on all 16 event types — "everywhere" is now true

Owner decision, 2026-08-01, verbatim: **"Drop the travel exclusion — offer Papic
everywhere."**

PR #3991 deleted the `travel` deny list and put `travel` in
`PAPIC_ACCESS_PHASE_1_TYPES`. That was necessary but not sufficient: **eight of the
sixteen live event types were still denied**, by two mechanisms other than the deny
list, so "everywhere" was not true.

**Before** (Papic offered — 8 of 16): `wedding` · `debut` · `birthday` ·
`christening` · `gender_reveal` · `graduation` · `simple_event` · `travel`, plus
`anniversary` *only when personally owned*.

**Denied, and why it was not just the list:**

| Type | Denied by | Reason code |
|---|---|---|
| `date`, `hangout` | in no phase set — the fail-closed default | `type_out_of_scope` |
| `reunion`, `celebration`, `gala_night` | `PAPIC_ACCESS_PHASE_2_TYPES`, and phase 2 is not live | `phase_not_reached` |
| `corporate`, `tournament` | `PAPIC_ACCESS_PHASE_3_TYPES`, likewise | `phase_not_reached` |
| `anniversary` (Samahan-owned) | a hardcoded controller split in `phaseForType()` that early-returned **before** the phase lists were consulted | `phase_not_reached` |

That last row is the trap: adding `anniversary` to the Phase-1 list on its own is a
**no-op edit that reads like a fix**. The split had to be deleted.

**After** (Papic offered — 16 of 16): every row of `public.event_type_vocab` that is
`status='active' AND enabled=true`. Verified against prod (`njrupjnvkjkitfctetvi`,
SELECT only): all 16 are active and enabled, and all 16 `event_type_profiles` rows
carry `rsvp`, so the surviving surface gate passes for every one.

- `apps/web/lib/papic-event-access.ts` — all 16 types in `PAPIC_ACCESS_PHASE_1_TYPES`;
  `PAPIC_ACCESS_PHASE_2_TYPES` / `_3_TYPES` emptied (kept as the re-tiering mechanism,
  with the gates they were waiting on preserved in comments); anniversary controller
  split removed from `phaseForType()`. The fail-closed default is **retained** — a
  seventeenth type, creatable from `/admin/event-types` with no code change, still does
  not inherit the pass.
- `apps/web/lib/papic-event-access.test.ts` — the test locking `date`/`hangout` as
  denied is inverted; new roster-driven test asserts every type in the union of
  `ANCHOR_BY_TYPE` + `AI_TIER_BY_EVENT_TYPE` is offered Papic, under **both**
  controllers, so a future type cannot silently fall outside "everywhere".
- Comment corrections where the old scope was asserted as fact:
  `lib/add-on-event-scope.ts`, `lib/add-ons-catalog.ts`, `lib/add-ons-catalog.test.ts`,
  `app/dashboard/[eventId]/suite/page.tsx`, `app/dashboard/[eventId]/studio/page.tsx`.

**ELIGIBILITY ONLY.** No pricing, entitlement, metering, pool size or free-grant path
is touched. This widens who may buy, nothing else. No migration.

⚠ **Open compliance debt this incurs, escalated to owner/DPO rather than deleted with
the code.** The phase ladder was a compliance ladder and its preconditions were not
met: Phase 2 was gated on **self-join hardening** (poster-QR self-join, not a
host-written roster, is the entry path for group types), Phase 3 on a **CSAM
known-hash matcher + an NPC Circular 16-02 processor agreement** (open-crowd
spectators are never RSVP'd or consented), and `date`/`hangout` were never assessed at
all. Shipped under the standing "document, don't block" default, alongside the
already-open verdict gates 0d/0e.

SPEC IMPACT: `0012_papic/` + `DECISION_LOG.md` — the Papic access scope is now ALL 16
event types. Supersedes the type axis of
`Papic_Access_Scope_Council_Verdict_2026-07-20.md` § 2 / Phase-0 gate 0h (its `rsvp`
requirement stands); retires the Phase 2/Phase 3 ladder as an access gate and reclasses
the self-join-hardening + CSAM-matcher + NPC Circular 16-02 preconditions as open
compliance items on a shipping product. Owner, 2026-08-01: **"Drop the travel exclusion
— offer Papic everywhere."**
