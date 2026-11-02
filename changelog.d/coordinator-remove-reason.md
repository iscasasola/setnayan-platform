## 2026-06-22 · feat(hosts): removing a coordinator now records why

Owner: when a couple removes a coordinator's access, they must pick a reason. The `event_moderators.removal_reason` column + the soft-remove flow already existed (it just hardcoded `'removed_by_couple'`); this captures the couple's actual choice.

- **`hosts/page.tsx`** — the Remove form now has a required reason `<select>` (native, no client JS): *No longer availing their services · Abuse / misuse · We have a new coordinator · Other*.
- **`hosts/actions.ts`** — `removeHost` reads + validates `reason` against that allow-list (falls back to the generic value) and stores it on `removal_reason`. `abuse_misuse` is the value to surface to admin later as a misbehavior signal.

No migration (the column exists; it's free-text, so the new values store cleanly). No access change — this only annotates the existing removal. SPEC IMPACT: iter 0048 coordinator delegate — removal now reason-tagged. Logged in corpus DECISION_LOG.
