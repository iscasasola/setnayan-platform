## 2026-11-16 · fix(chat): the "Set your call time" pin opens the call-time control (owner ruling A)

Owner ruling A (2026-11-16): a supplier can set their call time right away. Cut 5 (merged 2026-11-14) already gave the
supplier's Schedule tab its Your times control when the hosts have no chapters. The supplier chat's amber
"DUE NOW · Set your call time" pin still had no body, so its "Answer ›" did nothing. It now opens a short body with
"Set your call time", linking to `/vendor-dashboard/clients/<event>?tab=schedule#own-times`, which is the control itself.
The blocker's button goes to the same anchor. Saving the times now revalidates the chat, so the pin clears on the next
read (`callTimeIsSet`, unchanged). Held by `apps/web/lib/the-call-time-is-set-early.test.ts`.

Step 3 of the ruling (the couple's Schedule showing the supplier's call time) and the optional note are HELD for an owner
ruling on the model (crew call vs on-site times). No schema changes in this PR.

SPEC IMPACT: None.
