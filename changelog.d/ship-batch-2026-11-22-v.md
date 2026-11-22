## 2026-11-22 · chore(ship): batch V — #8180 the supplier's yes sees a full schedule

- **#8180** @ b88e143ab7: before a supplier says yes, the server checks the schedules the card uses. A schedule already full that day refuses the yes, names it, and points to Dates. A failed read lets the yes through and is logged, as every capacity read here does. Migration `20271359089802` → 14cba6d63a (controller GO): a new owner-only definer `vendor_card_schedules_on`, with anon revoked.

Generated files regenerated once. Exposure +1, intended: `vendor_card_schedules_on`, exec=authenticated, secdef, checks the owner inside.

SPEC IMPACT: None beyond #8180's own fragment.
