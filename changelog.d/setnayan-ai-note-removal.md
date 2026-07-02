## 2026-07-03 · fix(marketing): drop the "Covers all your events · 0% commission" trailer from Setnayan AI price blocks

Owner 2026-07-03: the line is irrelevant to Setnayan AI — 0% commission is a marketplace fact,
and "covers all your events" actually CONTRADICTED the per-event pricing lock (each event gets
its own ₱499 first 28 days, owner 2026-07-02; the line was a leftover of the per-user model).

Removed from all three AI price surfaces: the hero story (`setnayan-ai-story.tsx` + the now-unused
`.hr-ai-note` CSS), the nav pop-up (`HomeOverlays.tsx`), and the `/pricing` card ("Active until
your wedding day, then it ends" kept there — it's billing-term info on a pricing page). Verified
live in a local preview: "Covers all your events" appears nowhere on the homepage or pop-up.

SPEC IMPACT: None — copy trim per owner; per-event pricing already recorded (DECISION_LOG 2026-07-02).
