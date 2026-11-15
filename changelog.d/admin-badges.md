## 2026-11-15 · feat(admin): Money › Badges & seals, slice 1 — one page, the real ledger, the Spotlight Awards folded in, honest "not yet built" rows

Controller build, owner OK 15 Nov. Contract: `Setnayan-specs/prototypes/admin_badge_ledger_2026-11-15` (5bac5f14). Rulings: DECISION_LOG dd7d05f1 · 3cbf12c1 · 4b8cc3a3 · 50566f42 · 3077c9b3 · 7fbff0cd · 11d044c0.

- **A new Money view, "Badges & seals"** at `/admin/badges`. It has three sections, 2026 seals · Shops · Rewards, as one segmented control.
- **What's real:**
  - every badge reward ever given and the badge upgrades. These are the same reads and ledgers as Gifts & comps.
  - "Paid this year" (a refused read shows "—", never 0).
  - the **monthly Spotlight Awards, folded in** (dd7d05f1 (4)). `/admin/spotlight-awards` and the Studio tab now land here.
- **What waits on an engine** says "Not yet built", from one list (`app/admin/badges/not-yet-built.ts`):
  - the seals (Top 10 & No. 1, Clients' Choice, Most In-Demand, Verified Partner) and the 18 Dec lock (J2);
  - the shops' badge tiers (J0 #7753 through the one adapter #7807);
  - the card medals (J3);
  - the reward queue and holds.
  - No sample shop from the drawing ever renders.
- **Nothing is written:** no server action and no migration.
- **Guard:** `app/admin/badges/the-badge-page-is-honest.test.ts`, one test per claim. Sabotages landed red.

SPEC IMPACT: None — builds the approved drawing's first slice.
