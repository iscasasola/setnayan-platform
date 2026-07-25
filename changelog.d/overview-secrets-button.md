## 2026-07-25 · feat(admin): engine-room shortcuts (Secrets & Rotation · Integrations) at the top of Overview

Owner: *"i think you should place it on admin/overview and a button for secrets"* — after failing to find the Secrets board twice.

Why it was unfindable, for the record: the **2026-07-15 six-menu flatten** means child pages never get a sidebar row (they feed active-state + badges only), so a page in the Money & Settings group is reachable only from that group's hub card or a tile. The Overview already carried a `Secrets & Rotation` tile — but it sits in the tile grid *below* the Exception Desk, four work-lane sections, More queues, eight KPI cards, and the audit log. Correct, and effectively invisible.

Adds a slim two-pill `<nav aria-label="Engine room">` inside the Overview header: **Secrets & Rotation** (gold, primary) and **Integrations** (outline). Rare-but-urgent destinations should be one glance from the landing, not one memory away.

Deliberately pills, not tiles, and deliberately in the header: the Exception Desk is this view's single focal element (rollout § 1.3) and must not be out-shouted, and header placement means the row rides above the entrance cascade and never shifts when queue counts change. The existing bottom tile stays — a second doorway costs nothing.

SPEC IMPACT: None — two links on an existing surface; no routes, entitlements, or data touched.
