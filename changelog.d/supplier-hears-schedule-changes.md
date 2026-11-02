## 2026-11-02 · feat(schedule): a supplier is told when a host changes their part of the day

Supplier gate audit D6 (DECISION_LOG 2026-11-02 "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK" (6), owner: *"getting
notifications if they are changed by user"*). The host schedule actions imported `emitNotification` and called it
zero times, so an edit, a re-assign, a retime or a delete of a supplier's moment reached nobody.

- ONE notifier, `lib/supplier-part-notify.server.ts` (`partBefore` → write → `tellPartSuppliers`), called from
  `updateScheduleBlock` (field save, chapter move with its moments, and the moment-op door: crew lines, ticked
  suppliers, marches), `deleteScheduleBlock`, `setBlockResponsibleParty` and `bulkRetimeScheduleBlocks` (a single
  moment's drag; Running late keeps its own `schedule_shifted` notice and is not told twice).
- Reads `responsible_vendor_ids` BEFORE and AFTER the write, so a deleted moment and a supplier taken off are told.
  A guests-only toggle (`is_public`) or a re-order tells nobody (`toggleBlockVisibility` deliberately not wired).
- One save → one in-app notice per person (`supplier_part_changed`, new enum value 20271302920811), however many
  moments it touched; booked shops only; the person who saved is never told. Not on the email allowlist. Best-effort:
  a failed read or notice never undoes or fails the host's save.
- Guard: `lib/a-supplier-hears-their-part-change.test.ts` (rules executed; each action reads before and tells after).

SPEC IMPACT: None (implements the 2026-11-02 ruling; no decision changed).
