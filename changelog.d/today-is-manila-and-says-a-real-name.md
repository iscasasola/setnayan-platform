## 2026-09-10 · fix(vendor): the supplier's Today page shows Manila's day, and a real name

Three defects on the first screen a shop meets, all seen live.

The greeting passed the Philippine locale and no time zone, so it formatted the
server's UTC instant in Filipino wording — a supplier opening the app after 8pm
was shown yesterday, and every "today" on that page moved with it.

The only card under "What's new" rendered the raw message body, printing its own
markdown asterisks. `conversation-list.ts` already owned the rule for shortening
a generated body; it was private. Exported and consumed, not copied.

And the label inside that message fell back to `vendor_services.category` when a
card has no title — which both production cards do — so a shop read `live_band`.

SPEC IMPACT: applied — `DECISION_LOG.md` 2026-09-10.
